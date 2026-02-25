---
author: "given53"
generation: 6
level: "unclassified"
original_filename: "technical_writing.md"
source: "https://github.com/woowacourse/woowa-writing/blob/given53/technical_writing.md"
source_path: "technical_writing.md"
---

# 어노테이션 하나로 테스트에서 *LocalDateTime.now()* 제어하기

"테스트 실패해요."

땅콩 프로젝트는 `LocalDateTime.now()`로 현재 시간을 가져와서 비교하는 비즈니스 로직이 있습니다. 단위 테스트를 작성하고 자신있게 Pull Request를 올렸지만 CI에서 테스트가 실패했습니다. 테스트를 실행할 때마다 현재 시간이 달라져 어느 시점부터 완전히 실패하는 테스트가 되었기 때문이었습니다.

좋은 단위 테스트는 [F.I.R.S.T 원칙](https://howtodoinjava.com/best-practices/first-principles-for-good-tests/)을 따릅니다. 하지만 제가 구현한 테스트는 반복 가능한 테스트, 즉 **Repeatable** 원칙을 만족하지 못하고 있었습니다.

현재 시간과 같은 랜덤 요소를 제어하는 것은 테스트에서 매우 중요합니다. 저는 '랜덤한 시간을 제어해서 반복 가능한 테스트 만들기'를 넘어 두 가지도 함께 고민했습니다.

1. 테스트 가독성 높이기
2. 다른 팀원들도 테스트에서 쉽게 시간 제어하기

위 고민을 해결하기 위해 어떤 시도를 했는지, 그리고 어노테이션 하나로 시간을 어떻게 제어했는지 소개하겠습니다.

<br/>

## 테스트에서 시간을 어떻게 제어하면 좋을까?

Mock이란 [테스트 더블](https://www.javacodegeeks.com/2019/04/introduction-to-test-doubles.html) 방법 중 하나로, 테스트에서 실제 객체와 동일한 mock 객체를 만들어 특정 동작을 검증하거나 제어할 수 있게 하는 방법입니다. 이와 같은 과정을 모킹(Mocking)이라고 합니다.
스프링 부트에서는 `spring-boot-starter-test` 의존성에 포함된 [Mockito](https://site.mockito.org/) 프레임워크를 사용해서 객체를 쉽게 모킹할 수 있습니다.

그렇다면 `LocalDateTime.now()`를 모킹해서 원하는 시간을 반환하면 쉽게 해결되지 않을까요? 아쉽게도 `LocalDateTime.now()`는 static 메서드이기 때문에 `Mockito.mock()`과 같은 일반적인 모킹 방법으로는 제어하기 어렵습니다.

### 1. MockedStatic 사용하기

<img src='https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/mockStatic.png' width=600>

[Mockito 3.4.0](https://javadoc.io/doc/org.mockito/mockito-core/latest/org/mockito/Mockito.html#48) 버전 이상부터 MockedStatic을 사용해서 static 메서드를 모킹할 수 있습니다. 간단한 컨트롤러와 테스트를 작성해보겠습니다.

<br/>

```java
@RestController
public class TimeController {

    @GetMapping("/time")
    public String time() {
        LocalDateTime now = LocalDateTime.now();
        System.out.println("현재 시간: %s".formatted(now));
        return now.toString();
    }
}

```

```java
@WebMvcTest(TimeController.class)
class TimeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void 현재_시간_모킹_테스트() throws Exception {
        // given
        LocalDateTime now = LocalDateTime.parse("2024-10-31T12:30:15");
        MockedStatic<LocalDateTime> localDateTimeMockedStatic = Mockito.mockStatic(LocalDateTime.class);
        localDateTimeMockedStatic.when(LocalDateTime::now).thenReturn(now);

        // when & then
        mockMvc.perform(get("/time"))
                .andExpect(jsonPath("$").value("2024-10-31T12:30:15"));

        localDateTimeMockedStatic.close();
    }
}
```
MockedStatic으로 LocalDateTime을 모킹한 후 `now()`를 호출했을 때 고정된 시간을 반환하도록 합니다.

<br/>

<img src="https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/mockStatic_WebMvc.png" width=700>

테스트를 실행하면 모킹한 시간이 잘 반환되고 있습니다. 문제를 해결했나 싶었지만 MockedStatic은 스레드 로컬로 동작하기 때문에 **두 가지의 문제점**이 있었습니다.

1. 리소스를 해제하지 않으면 MockedStatic이 스레드에 활성 상태로 남아있게 되고, 같은 스레드를 재사용하는 다른 테스트에 영향을 줄 수 있습니다. 그래서 try-with-resources 구문을 사용하거나 `close()`를 명시적으로 호출해서 **항상 리소스를 해제**해야 합니다.

2. [@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)을 사용하면 HTTP 클라이언트가 테스트와 별도의 스레드에서 실행되기 때문에 스레드 로컬로 처리되는 MockedStatic이 반영되지 않습니다. 땅콩은 컨트롤러 테스트로 RestAssured와 WebEnvironment.RANDOM_PORT를 사용하기 때문에 이 방식으로는 문제를 해결할 수 없습니다.

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class TimeControllerTest {

    private static final Logger log = LoggerFactory.getLogger(TimeControllerTest.class);

    @LocalServerPort
    private int port;

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
    }

    @Test
    void 현재_시간_모킹_테스트() {
        // given
        LocalDateTime now = LocalDateTime.parse("2024-10-31T12:30:15");
        log.info("모킹한 시간: {}", now);
        MockedStatic<LocalDateTime> localDateTimeMockedStatic = Mockito.mockStatic(LocalDateTime.class);
        localDateTimeMockedStatic.when(LocalDateTime::now).thenReturn(now);

        // when
        RestAssured.when()
                .get("/time");

        localDateTimeMockedStatic.close();
    }
}

```

<img src="https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/mockStatic_RestAssured.png" width=1000>

실제로 테스트를 해보면 서로 다른 스레드에서 실행되어 모킹이 적용되지 않음을 확인할 수 있습니다.

### 2. LocalDateTime을 래핑하는 클래스

```java
@Component
public class LocalDateTimeWrapper {

    public LocalDateTime now() {
        return LocalDateTime.now();
    }
}
```

LocalDateTime을 한 번 감싸는 래핑 클래스를 bean으로 사용하고 테스트 더블로 대체하는 방법입니다. 이 클래스를 주입해서 사용하는 서비스와 테스트를 작성해보겠습니다.

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class TimeService {

    private final LocalDateTimeWrapper localDateTimeWrapper;

    public void printCurrentTime() {
        LocalDateTime now = localDateTimeWrapper.now();
        log.info("현재 시간: {}", now);
    }
}
```

```java
@SpringBootTest
public class TimeServiceTest {

    private static final Logger log = LoggerFactory.getLogger(TimeServiceTest.class);

    @Autowired
    private TimeService timeService;

    @MockBean
    private LocalDateTimeWrapper localDateTimeWrapper;

    @Test
    void 현재_시간_모킹_테스트() {
        // given
        LocalDateTime now = LocalDateTime.parse("2024-12-12T00:00:00");
        log.info("모킹한 시간: {}", now);
        when(localDateTimeWrapper.now()).thenReturn(now);

        // when
        timeService.printCurrentTime();
    }
}
```

<img src="https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/localdatetime_wrapper.png" width=1000>

모킹한 시간이 반환되었습니다. 간단하게 해결할 수 있는 방법이지만 **두 가지의 문제점**이 있습니다.
1. 일반적이지 않은 코드이기 때문에 인지 비용이 발생합니다.
2. 단순히 `LocalDateTime.now()`를 한 번 감싸기 위해 관리해야 할 클래스가 하나 더 늘어납니다.

<br>

마지막으로 `LocalDateTime.now()`가 어떻게 구현되어 있는지 살펴보면서 다른 해결 방법을 찾아보겠습니다.

### 3. Clock 객체를 bean으로 등록 후 모킹

<img src='https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/localdatetime.png' width=600>

`LocalDateTime.now()`는 Clock을 파라미터로 받는 오버로딩 메서드를 호출하고 있습니다.

<img src='https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/localdatetime_clock.png' width=600>

내부적으로만 사용하는 줄 알았는데 접근제어자가 public이네요! Javadoc을 보면 테스트를 위해 대체 Clock을 사용할 수 있다고 안내하고 있습니다. 이 메서드를 사용하면 시간을 쉽게 제어할 수 있어 보입니다.

> - Instant <br/>
타임라인에서 한 지점을 나타내는 순간을 나타내며, UTC 기준 `1970-01-01T00:00:00`를 0(epoch)으로 정하고 이로부터 경과된 시간을 양수 또는 음수로 표현합니다.
> - ZoneId <br/>
UTC, Asia/Seoul 등 특정 지역의 시간대 정보를 나타내는 타임존입니다.
> - Clock <br/>
Instant와 ZoneId를 사용해 현재 날짜, 시간을 제공하는 추상클래스입니다.

<br/>

```java
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of("Asia/Seoul"));
    }
}
```
먼저 Clock을 bean으로 등록합니다.

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class TimeService {

    private final Clock clock;

    public void printCurrentTime() {
        LocalDateTime now = LocalDateTime.now(clock);
        log.info("현재 시간: {}", now);
    }
}
```
Clock bean을 의존성 주입 후 `LocalDateTime.now(clock)`로 변경합니다.

```java
@SpringBootTest
public class TimeServiceTest {

    private static final Logger log = LoggerFactory.getLogger(TimeServiceTest.class);

    @Autowired
    private TimeService timeService;

    @MockBean
    private Clock clock;

    @Test
    void 현재_시간_모킹_테스트() {
        Instant now = Instant.parse("2024-12-31T00:00:00Z");
        log.info("모킹한 시간: {}", now);
        when(clock.instant()).thenReturn(now);
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);

        timeService.printCurrentTime();
    }
}
```

테스트에서는 Clock을 MockBean으로 주입하고 현재 시간을 만들어낼 때 사용하는 Instant를 원하는 값으로 반환합니다.

<img src="https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/clock_mocking.png" width=1000>

테스트를 실행하면 모킹한 시간이 반환되고 있습니다.

> 🚨 **주의할 점**은 Zone에 따라 Instant에 작성한 시간을 변환하기 때문에 Zone이 UTC가 아니면 `LocalDateTime.now(clock)`에서 예상하지 않은 시간이 반환됩니다.
>```java
>@Test
>void 현재_시간_모킹_테스트() {
>    Instant now = Instant.parse("2024-12-31T00:00:00Z");
>    log.info("모킹한 시간: {}", now);
>    when(clock.instant()).thenReturn(now);
>    when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
>
>    timeService.printCurrentTime(); // -> +9시간된 2024-12-31T09:00:00Z 반환
>}
>```

<br>

하지만 Clock을 사용하는 테스트마다 모킹하는 보일러플레이트 코드를 작성해야 하는 점이 매우 번거롭습니다. `@TestConfiguration`을 사용하면 **고정된 Clock 객체**를 primary bean으로 등록해서 테스트 전역으로 Clock을 제어할 수 있습니다. 가짜 객체가 진짜 객체처럼 행동하는 테스트 더블의 Fake 방법입니다.

```java
@TestConfiguration
public class TestConfig {

    @Primary
    @Bean
    public Clock testClock() {
        return Clock.fixed(Instant.parse("2024-12-31T00:00:00Z"), ZoneOffset.UTC);
    }
}
```
```java
@SpringBootTest
@Import(TestConfig.class)
public class TimeServiceTest {

    @Autowired
    private TimeService timeService;

    @Test
    void 현재_시간_모킹_테스트() {
        timeService.printCurrentTime();
    }
}
```
테스트에서 `@Import`로 설정을 적용하면 고정된 Clock 객체를 사용합니다. 반복되는 보일러플레이트 코드가 모두 사라졌습니다!

<br/>

## 커스텀 어노테이션으로 현재 시간을 제어할 수 없을까?

`@TestConfiguration`을 사용해서 Clock bean을 전역으로 제어했지만 테스트를 작성할 때 여전히 불편함이 있었습니다.
1. 매번 TestConfiguration에 고정된 시간을 확인하면서 테스트를 작성해야 함 ('시간 언제로 고정되어 있었지?')
2. 테스트를 유연하게 작성하기 어려움 ('이 테스트에서는 다른 시간으로 고정해야 하는데...')
3. 테스트에서 데이터를 왜 x시간으로 저장했는지 한 번에 읽히지 않음 ('이 테스트는 왜 x시간으로 저장하지?')

### JUnit 5의 extension 사용
`@TestConfiguration`의 불편함을 극복하기 위해서 extension 기능을 활용했습니다. JUnit 5부터 도입된 extension은 테스트 라이프사이클의 다양한 단계에 특정 동작을 확장할 수 있는 기능입니다.

extension 중에서 **라이프사이클 콜백**을 사용하면 테스트 전, 후로 메서드를 실행할 수 있습니다. 실행 순서는 다음과 같습니다.
```
1. BeforeAllCallback
2. @BeforeAll
3. BeforeEachCallback
4. @BeforeEach
5. BeforeTestExecutionCallback
6. Test 실행
7. AfterTestExecutionCallback
8. @AfterEach
9. AfterEachCallback
10. @AfterAll
11. AfterAllCallback
```

여기서 BeforeEachCallback 인터페이스를 구현해서 Clock bean을 모킹하겠습니다.

```java
public class FixedClockExtension implements BeforeEachCallback {

    private static final Pattern DATE_PATTERN = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
    private static final Pattern TIME_PATTERN = Pattern.compile("\\d{2}:\\d{2}:\\d{2}");

    @Override
    public void beforeEach(ExtensionContext context) {
        Clock clock = SpringExtension.getApplicationContext(context).getBean(Clock.class);
        FixedClock fixedClockAnnotation = getFixedClockAnnotation(context);

        String date = getDate(fixedClockAnnotation);
        String time = getTime(fixedClockAnnotation);
        when(clock.instant()).thenReturn(Instant.parse("%sT%sZ".formatted(date, time)));
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    }

    private FixedClock getFixedClockAnnotation(ExtensionContext context) {
        FixedClock fixedClockAnnotation = context.getRequiredTestMethod().getDeclaredAnnotation(FixedClock.class);
        if (fixedClockAnnotation == null) {
            fixedClockAnnotation = context.getRequiredTestClass().getDeclaredAnnotation(FixedClock.class);
        }
        return fixedClockAnnotation;
    }

    private String getDate(FixedClock fixedClockAnnotation) {
        String date = fixedClockAnnotation.date();
        if (!DATE_PATTERN.matcher(date).matches()) {
            throw new IllegalArgumentException("yyyy-MM-dd의 date 포맷이어야 합니다. invalid date: %s".formatted(date));
        }
        return date;
    }

    private String getTime(FixedClock fixedClockAnnotation) {
        String time = fixedClockAnnotation.time();
        if (!TIME_PATTERN.matcher(time).matches()) {
            throw new IllegalArgumentException("HH:mm:ss의 time 포맷이어야 합니다. invalid time: %s".formatted(time));
        }
        return time;
    }
}
```
FixedClock은 뒤에 설명할 커스텀 어노테이션입니다. 리플렉션으로 테스트 메서드나 테스트 클래스를 읽어서 `@FixedClock` 어노테이션을 찾습니다. 이때 메서드에 작성된 어노테이션이 클래스에 작성된 어노테이션보다 우선적으로 적용됩니다. Application Context에 존재하는 Clock bean을 찾아서 어노테이션에 작성된 날짜와 시간으로 모킹합니다.

### 커스텀 어노테이션 생성
```java
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@ExtendWith(FixedClockExtension.class)
public @interface FixedClock {

    String date();

    String time();
}
```
테스트에서 사용할 커스텀 어노테이션입니다. 테스트를 유연하게 작성하기 위해 메서드와 클래스 모두 허용하도록 구현했습니다.
extension은 테스트에서 `@ExtendWith` 어노테이션을 작성하면 적용됩니다. 여기서는 `@FixedClock` 어노테이션에 포함했기 때문에 테스트에서 `@FixedClock`을 사용하면 FixedClockExtension이 자동으로 동작합니다.

### 테스트 적용
```java
@SpyBean(Clock.class)
@FixedClock(date = "2025-01-01", time = "00:00:00")
@SpringBootTest
public class TimeServiceTest {

    @Autowired
    private TimeService timeService;

    @Test
    void 현재_시간_모킹_테스트1() {
        timeService.printCurrentTime();
    }

    @Test
    @FixedClock(date = "2024-12-25", time = "00:00:00")
    void 현재_시간_모킹_테스트2() {
        timeService.printCurrentTime();
    }
}
```
Clock 객체는 테스트 클래스에서 실제 객체 또는 mock 객체로 모두 사용되기 때문에 SpyBean으로 등록합니다.

<img src="https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/fixed_clock_class.png" width=1000>

첫 번째 테스트는 메서드에 `@FixedClock`을 사용하지 않았기 때문에 클래스의 `@FixedClock`이 적용되어 `2025-01-01T00:00:00Z`으로 현재 시간을 반환합니다.

<br>

<img src="https://raw.githubusercontent.com/woowacourse/woowa-writing/given53/images/fixed_clock_method.png" width=1000>

두 번째 테스트는 메서드에 `@FixedClock`을 사용했기 때문에 `2024-12-25T00:00:00Z`으로 현재 시간을 반환합니다.

> 🚨 `@SpyBean` 어노테이션은 클래스 또는 필드에서만 사용할 수 있습니다. 만약 `@FixedClock`을 클래스에서만 사용할 수 있도록 제한하면 `@SpyBean(Clock.class)`도 `@FixedClock`에 포함할 수 있습니다. <br/>
> 현재 구현은 `@FixedClock`을 메서드에서도 사용할 수 있기 때문에 어노테이션이 메서드 레벨에만 사용됐을 경우 `@SpyBean`이 동작하지 않아 예외가 발생합니다.

이제 `@FixedClock` 어노테이션만 명시하면 어노테이션에 작성한 날짜, 시간으로 현재 시간을 반환할 수 있게 되었습니다!

<br/>

## 마치며
지금까지 테스트에서 현재 시간을 제어하는 여러 가지 방법과 어노테이션을 사용해서 제어하는 방법까지 알아보았습니다. 땅콩은 어노테이션 기반 제어 방법을 적용해서 세 가지의 장점을 얻을 수 있었습니다.
1. 어노테이션 하나만 사용하면 현재 시간을 쉽게 제어할 수 있다.
2. 테스트마다 독립적으로 고정된 시간을 사용해서 유연하게 테스트를 작성할 수 있다.
3. 고정된 시간이 무엇인지 명확히 보여주기 때문에 가독성이 향상된다.

다양한 방법을 비교해 보고 자신 또는 팀에 적합한 방법을 선택하는 것이 중요하다고 생각합니다. 부족한 글이지만, 저와 비슷한 고민을 했던 개발자분들에게 조금이나마 도움이 되었으면 좋겠습니다. 감사합니다.

<br/>

## 레퍼런스
- https://www.baeldung.com/mockito-mock-static-methods
- https://github.com/mockito/mockito/issues/1013
- https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/time/LocalDateTime.html#now(java.time.Clock)
- https://www.baeldung.com/junit-5-extensions
