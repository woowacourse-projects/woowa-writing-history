---
author: "pricelees"
generation: 6
level: "unclassified"
original_filename: "TECHNICAL.md"
source: "https://github.com/woowacourse/woowa-writing/blob/pricelees/TECHNICAL.md"
source_path: "TECHNICAL.md"
---

# Springboot와 Firebase를 이용하여 웹 알림 구현하기

특정 서비스를 만들 때 가장 중요한 것 중 하나는 **알림 기능**인 것 같습니다. 

프로젝트 기간동안 **하나의 모임을 성사시키는 서비스**(=모우다)를 만들었는데, 모든 기능이 정상적으로 작동해도 사용자가 이를 모른다면 아무 의미가 없을 것이기에 **알림 기능**은 꼭 필요한 기능이었습니다.  

이번 글에서는 모우다 서비스의 웹 알림 기능 구현에 사용한 **Firebase Cloud Message**(이하 FCM)를 소개하고, **백엔드에서의 구현 방법**을 간단한 예시 코드와 함께 살펴보겠습니다.


> 본문에 작성된 코드는 실제 모우다 서비스의 코드가 아닌 예시를 위해 간단하게 작성한 코드입니다.
예시 코드는 설명이 목적이므로 추상화, 메서드 분리 등의 과정을 적용하지 않고 가급적 풀어서 작성하였습니다.
>

## Firebase Cloud Messaging 이란?

### 개요

[공식 문서](https://firebase.google.com/docs/cloud-messaging?hl=ko)에선, FCM을 메시지를 **안정**적으로 **무료** 전송할 수 있는 **크로스 플랫폼** **메시징 솔루션**이라고 소개합니다.

모우다 팀에서 FCM을 선정한 이유를 들어, 이 소개 문구에 있는 몇 가지 특징들을 살펴보겠습니다.

1. **안정적**: FCM은 **구글**에서 제공하는 서비스이기에 알림 메시지 전송의 신뢰성을 보장할 것이라고 기대할 수 있습니다.
2. **무료 전송**: 유료로 제공되는 기능도 있지만, 서비스의 초기 단계인 지금은 무료 버전으로도 충분히 구현할 수 있습니다.
3. **크로스 플랫폼**: FCM은 **웹 뿐만 아니라 IOS, Android도 지원**합니다. 따라서 추후에 모바일로 확장하기에도 유리합니다.

여기에 **구현 자체가 간단하고, 공식 문서가 잘 되어있다는 장점**도 있었습니다. 실제로 본문에서 다루는 모든 구현 과정은 모두 공식 문서만을 활용했습니다.😄

### 구조

전반적인 구조는 [공식 문서](https://firebase.google.com/docs/cloud-messaging/fcm-architecture?hl=ko)에서 확인하실 수 있고, 여기선 실제 모우다 서비스에서 사용하는 구조로 설명해 보겠습니다.

> **파란색 선은 클라이언트**(프론트엔드), **빨간색 선은 서버**(백엔드), **초록색 선은 FCM 서버**에 해당됩니다.
>

![fcm_흐름도](https://github.com/pricelees/woowa-writing/blob/level4/level4-image/fcm_flow.png)

FCM 토큰은 **앱 인스턴스**마다 고유하다고 하는데요, 여기서의 앱 인스턴스는 하나의 애플리케이션에 해당됩니다.

즉 웹 푸시 알림의 경우를 생각하면 같은 기기라도 서로 다른 브라우저마다 각각의 토큰이 부여되고, 따라서 한 명의 회원이 여러 개의 FCM 토큰을 발급받을 수 있습니다. 

이 과정대로라면 백엔드 서버에서 할 일은 다음과 같습니다.

1. 클라이언트가 토큰을 보내면 **사용자 정보와 함께 데이터베이스에 저장**하는 API를 만든다.
2. 특정 이벤트(모임 생성, 댓글, 채팅)에 대한 처리를 하고, 이 이벤트에 대한 알림을 받을 회원의 토큰을 조회한다.
3. 사용자에게 보낼 알림 메시지 정보를 생성하고, 2에서 조회한 토큰과 함께 FCM 서버에 메시지 전송 요청을 보낸다.
4. DB에 저장된 토큰을 관리한다.

간단하게 요약하면, `클라이언트가 토큰을 보낸 이후부터 사용자가 알림 메시지를 받을 때 까지의 모든 과정`을 백엔드에서 진행한다고 생각하시면 됩니다.

이제 위 내용을 바탕으로 Springboot에서의 토큰 관리, 메시지 전송, 예외 핸들링에 대해 작성해 보겠습니다.

## FCM 환경 설정

### FCM 비공개 키 JSON 등록

우선 FCM 프로젝트를 생성하고, 해당 프로젝트 설정 → 서비스 계정 탭에 들어가서 **새 비공개 키 생성** 버튼을 눌러 JSON 파일을 받은 뒤 프로젝트 경로로 옮겨주세요. 저는 `src/main/resources/firebase/serviceAccountKey.json` 에 저장하겠습니다.

![sample_code](https://github.com/pricelees/woowa-writing/blob/level4/level4-image/fcm_sample_code.png)

파일을 옮겼으면 이제 FirebaseApp 을 실행하는 코드를 작성해주면 되는데요, 위에 있는 FCM 에서 제공하는 코드를 바탕으로 초기화 코드를 작성해 보겠습니다. 

```java
@Component
@Slf4j
public class FcmAppInitializer {

    private static final String SERVICE_ACCOUNT_KEY = "/firebase/serviceAccountKey.json";
    
    @PostConstruct
    public void init() {
        InputStream serviceAccount = getClass().getResourceAsStream(SERVICE_ACCOUNT_KEY);
    
        try (serviceAccount) {
            Assert.isTrue(serviceAccount != null, "service account key file not found");
    
            FirebaseOptions options = new FirebaseOptions.Builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build();
    
            FirebaseApp.initializeApp(options, FirebaseApp.DEFAULT_APP_NAME);
        } catch (Exception e) {
            log.error("Failed to initialize FirebaseApp", e);
        }
    }
}
```

코드의 과정은 다음과 같습니다.

1. Springboot 앱 실행시 FirebaseApp을 실행하기 위해 `@PostConstruct` 를 이용합니다.
2. `getResourceAsStream()` 을 통해 비공개 키 json을 조회합니다.
3. 조회된 비공개 키로 FirebaseOptions 객체를 만든 뒤 `FirebsseApp.initializeApp()` 으로 실행합니다.
    - 두 번째 인자는 사용하고자 하는 FirebaseApp의 이름입니다.
    - FirebaseApp.DEFAULT_APP_NAME 은 `[DEFAULT]` 라는 이름이며, 저는 예시를 위해 지정했을 뿐 기본값이라 지정하지 않아도 됩니다.

### FileInputStream과 getResourceAsStream()

예시 코드에서는 `new FileInputStream()` 으로 serviceAccountKey.json을 조회하고 있는데, 제가 작성한 예시 코드에서는 `getResourceAsStream()` 을 사용하고 있습니다.

결론만 간단하게 말씀드리면 **IDE에서 실행할 때의 파일 경로와 빌드된 JAR에서의 경로가 다르기 때문**인데요, FileInputStream을 사용하면 배포 환경에서는 `FileNotFoundException` 이 발생합니다.

반면에 `getResourceAsStream()` 는 classpath에서 파일을 읽는 방식인데요, 아래 코드로 로컬(IDE) / 배포(JAR) 환경에서 로그를 찍어보겠습니다.

```java
InputStream serviceAccount = getClass().getResourceAsStream(SERVICE_ACCOUNT_KEY)
log.info("InputStream: {}", serviceAccount);
```

로그를 보면 로컬에서 실행하면 `BufferedInputStream`, 배포 환경에서는 `JarUrlConnection$ConnectionInputStream` 객체를 얻습니다. 즉 `getResourceAsStream()` 은 로컬과 배포 환경 모두 지원하므로 FileInputStream 대신 이를 사용하였습니다.

## FCM 토큰 등록

### FCM 토큰 관리

[공식 문서](https://firebase.google.com/docs/cloud-messaging/manage-tokens?hl=ko#remove-stale-tokens)에 있는 FCM 토큰 관리에 대한 내용을 요약해서 작성해볼게요.

우선, FCM에서는 토큰을 다음과 같이 분류합니다.

1. FCM은 **1개월 이상 연결되지 않은 토큰을** **비활성 토큰**으로 간주하고, 이 토큰은 다시 연결될 가능성도 낮다고 판단합니다.
2. 비활성 토큰이 **270일 동안 비활성 상태이면** **만료된 토큰**으로 간주합니다.
3. 만료된 토큰 / 삭제된 토큰에 메시지를 보내면 **UNREGISTERED(HTTP 404)** 코드를 반환합니다.

이에 따라 FCM에서는 다음을 권장합니다.

1. 서버에서 **FCM 토큰과 타임스탬프**를 저장한다.
2. 사용자 접속 시 타임스탬프를 업데이트하고, 비활성화된 토큰은 삭제한다.

저는 이 권장사항에 따라, DB에 토큰과 타임스탬프를 저장하고 한 달이 경과된 토큰은 자동으로 삭제하도록 하겠습니다.

### FCM 토큰 등록하기

사용자는 여러 환경에서 서비스를 사용할 수 있기에, 사용자와 토큰은 일대다(1:N) 관계로 구성해야 합니다.

> DB는 Spring Data JPA를 사용하겠습니다.
>

예시를 위해 필드는 최대한 간단하게만 넣어볼게요.

![ERD](https://github.com/pricelees/woowa-writing/blob/level4/level4-image/fcm_erd.png)

ERD를 그려보면 위 처럼 나오고, 이를 JPA의 Entity로 구성하면 다음과 같습니다.

```java
@Entity
@Table(name = "fcm_tokens")
@NoArgsConstructor
@Getter
public class FcmTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JoinColumn(name = "user_id")
    @ManyToOne
    private UserEntity user;

    private String token;

    private boolean isActive;

    private LocalDateTime lastUpdated;

    @Builder
    public FcmTokenEntity(UserEntity user, String token) {
        this.user = user;
        this.token = token;
        this.isActive = true;
        this.lastUpdated = LocalDateTime.now();
    }

    public void refresh() {
        this.lastUpdated = LocalDateTime.now();
    }

    public boolean isInactive() {
        LocalDateTime threshold = LocalDateTime.now().minusMonths(1L);
        return lastUpdated.isBefore(threshold);
    }

    public boolean isExpired() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(270L);
        return isInactive() && lastUpdated.isBefore(threshold);
    }

    public void activate() {
        this.isActive = true;
    }
    
    public void deactivate() {
        this.isActive = false;
    }
}

```

FCM 토큰 엔티티는 테이블 구조와 동일하게 구성하였고, 활성화 / 만료 여부 판단 메서드와 활성화 / 비활성화 메서드를 추가했습니다.

```java
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String account;

    @Builder
    public UserEntity(String account) {
        this.account = account;
    }
}
```

회원 정보는 최대한 간단하게 계정 필드만 넣어서 구성했습니다. OneToMany로 양방향 매핑을 할 수도 있지만, 회원을 조회할 때 반드시 토큰까지 조회 할 이유는 없다고 생각해서 일단 단방향으로 구성하였습니다. 

이제 토큰을 등록하는 API를 만들어 보겠습니다.

```java
// Controller
@RestController
@RequiredArgsConstructor
public class FCMController {

    private final FCMTokenService fcmTokenService;

    @PostMapping("/tokens/fcm")
    public void saveToken(
        @Authenticated Long userId, @Valid @RequestBody FcmTokenRequest request
    ) {
        fcmTokenService.saveOrRefreshToken(userId, request);
    }
}

// DTO
public record FcmTokenRequest(
	@NotEmpty
	String token
) {
}
```

`POST /tokens/fcm`  요청을 받아 토큰을 등록하는 API를 만듭니다. `userId`는 로그인 된 회원의 ID값이고, 인터셉터에서 처리한다고 가정하겠습니다.

클라이언트에서는 **DOMContentLoaded** 등을 통해 메인 페이지에 들어가면 이 API를 호출하도록 구현할 수 있습니다!

```java
@Service
@RequiredArgsConstructor
public class FCMTokenService {

    private final FcmTokenRepository fcmTokenRepository;
    private final UserRepository userRepository;

    public void saveOrRefreshToken(Long userId, FcmTokenRequest tokenRequest) {
        String token = tokenRequest.token();
        Optional<FcmTokenEntity> tokenEntity = fcmTokenRepository.findByToken(token);
        tokenEntity.ifPresentOrElse(this::refresh, () -> save(userId, token));
    }

    private void refresh(FcmTokenEntity tokenEntity) {
        if (tokenEntity.isInactive()) {
            tokenEntity.activate();
        }
        tokenEntity.refresh();
        fcmTokenRepository.save(tokenEntity);
    }

    private void save(Long userId, String token) {
        Optional<UserEntity> userEntity = userRepository.findById(userId);
        userEntity.ifPresent(u -> {
            FcmTokenEntity fcmToken = FcmTokenEntity.builder().token(token).user(u).build();
            fcmTokenRepository.save(fcmToken);
        });
    }
}

```

토큰을 등록하는 서비스 코드입니다. Optional의 `ifPresentOrElse()` 를 사용해서 토큰이 존재하면 업데이트 또는 활성화하고, 없으면 저장하도록 합니다.

### 토큰 비활성화 / 만료된 토큰 제거

등록된 토큰을 조회한 뒤 lastUpdated 필드를 확인하여 한 달이 지났다면 비활성화하고, 비활성화 이후 270일이 경과한 경우에는 삭제하는 코드를 작성해 보겠습니다. 다른 방법들도 있지만 저는 **@Scheduled**를 사용했습니다.

```java
@Scheduled(cron = "0 0 0 1 * ?")
public void deleteExpiredToken() {
    LocalDateTime oneMonthAgo = LocalDateTime.now().minusMonths(1L);

    fcmTokenRepository.findAll().forEach(this::deactiveOrDelete);
}

private void deactiveOrDelete(FcmTokenEntity tokenEntity) {
    if (tokenEntity.isExpired()) {
        fcmTokenRepository.delete(tokenEntity);
        return;
    }
    if (tokenEntity.isInactive()) {
        tokenEntity.refresh(); // 날짜 최신화
        tokenEntity.deactivate();
        fcmTokenRepository.save(tokenEntity);
    }
}
```

저는 **매월 1일**에 확인할 예정이기에 `cron = 0 0 0 1 * ?`  으로 지정하였습니다. 토큰이 만료된 경우 삭제하고, 토큰이 갱신된지 한 달 이상이라면 비활성화 상태로 지정합니다.

토큰의 만료(expire)는 비활성화된 날짜 기준으로 270일이 경과한 경우이기에, 토큰을 비활성화 하더라도 날짜는 최신으로 업데이트를 해줘야 합니다!

여기까지 하면 토큰에 대한 설정은 끝났고, 이제 메시지를 보내는 과정을 다뤄보겠습니다.

## FCM 알림 메시지 전송하기

### 개요

메시지 전송은 크게 **단일 토큰을 담아 전송** / **여러 개의 토큰을 배치로 묶어서 전송** / **특정 토픽을 이용하여 전송**하는 방법으로 나뉩니다. 저는 토픽을 제외한 나머지 두 방법에 대해서만 다뤄보겠습니다.

> 토픽의 등록 및 관리는 [공식 문서- 토픽 등록](https://firebase.google.com/docs/cloud-messaging/manage-topics?hl=ko)에서, [전송은 공식 문서 - 주제로 메시지 전송](https://firebase.google.com/docs/cloud-messaging/send-message?hl=ko#send-messages-to-topics)에서 확인하실 수 있습니다.
>

> 토픽은 하나의 FCM 서비스당 2,000개까지만 등록이 가능하여, 저희 서비스에서는 2,000개의 토큰은 부족할 것이라 판단하여 사용하지 않았습니다. 
>

우선, 자바에서 FCM 알림 전송을 요청하는 과정을 요약하면 다음과 같습니다.

1. Firebase 에서 제공하는 **Message 객체(배치 전송은 MulticastMessage)** 를 만든다.
2. **FirebaseMessaging.getInstance()** 로 FirebaseMessaging 인스턴스를 생성한다.
3. 1에서 만든 객체를 2에서 얻은 인스턴스의 **send**(단일 전송) / **sendEachForMulticast**(배치 전송)에 담아 호출한다.

그러면 전송을 하기 전에 우선 Message 객체에 대해 살펴봐야겠네요. 우선 Message 객체를 간단하게 확인해 보겠습니다.

### Message 객체

[공식 문서](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages?hl=ko)의 내용을 보면, Message는 아래와 같은 형식으로 이루어져 있습니다.

```json
{
  "name": string,
  "data": {
    string: string,
    ...
  },
  "notification": {
    object (Notification)
  },
  "android": {
    object (AndroidConfig)
  },
  "webpush": {
    object (WebpushConfig)
  },
  "apns": {
    object (ApnsConfig)
  },
  "fcm_options": {
    object (FcmOptions)
  },

  // Union field target can be only one of the following:
  "token": string,
  "topic": string,
  "condition": string
  // End of list of possible types for union field target.
}
```

일단 웹 푸시 알림을 구현하는데 필요한 필드만 살펴보겠습니다. 나머지는 공식 문서를 확인해주세요!

**Notification**

```java
{
  "title": string,
  "body": string,
  "image": string
}
```

**제목 / 내용 / 알림에 표시되는 이미지(URL)** 로 이루어진 **모든 플랫폼에서 사용할 기본 알림 템플릿 객체**입니다.

이 객체의 내용은 모든 플랫폼에 적용되며, 특정 플랫폼마다의 Notification을 지정할 수도 있습니다.

(예를 들어, 안드로이드에만 적용되는 AndroidNotification, 웹에만 적용되는 WebpushNotification이 있습니다.)

**FCM에서 사용하는 객체들은 빌더를 이용하여 생성**하는데요, Notification 객체를 생성하는 코드는 다음과 같습니다. 저는 제목과 내용만 담아볼게요.

```java
Notification notification = Notification.builder()
            .setTitle("Portugal vs. Denmark")
            .setBody("great match!")
            .build();
```

**fcm_options**

```java
// 모든 플랫폼에 적용되는 fcm_options
{
  "analytics_label": string
}

// 웹 푸시에서의 fcm_options
{
  "link": string,
  "analytics_label": string
}
```

모든 플랫폼에 적용되는 FCM 옵션이고, Notification과 마찬가지로 각 플랫폼마다의 별도의 fcm_options이 존재합니다.

저는 웹 푸시 알림에서의 설정인 WebpushFcmOptions를 생성해볼텐데, 여기서의 link는 알림 클릭시 열리는 링크입니다.

```java
WebpushFcmOptions webpushOptions = WebpushFcmOptions.builder()
                .setLink("https 경로")
                .build();
			
WebpushFcmOptions webpushOptions = WebpushFcmOptions.withLink("https 경로");
```

생성은 위의 코드처럼 빌더를 이용할 수도 있고, 링크만 지정하는 경우 `withLink()` 로 생성할 수도 있습니다.

**webpush**

```java
{
  "headers": {
    string: string,
    ...
  },
  "data": {
    string: string,
    ...
  },
  "notification": {
    object
  },
  "fcm_options": {
    object (WebpushFcmOptions)
  }
}
```

웹 푸시와 관련된 여러 옵션을 지정할 때 사용되며, android(안드로이드), apns(IOS)도 구성은 비슷합니다. 자세한 내용은 [공식 문서](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages?hl=ko#webpushconfig)를 참고해주세요!

이제 Webpush에 해당되는 객체를 생성해볼텐데, 이전의 fcm_options에서 만든 webpushOptions은 setFcmOptions를 통해 지정할 수 있습니다.

```java
WebpushConfig webpushConfig = WebpushConfig.builder()
        .setFcmOptions(webpushOptions)
        .build();
```

### 메시지 객체 생성 및 전송

이제 Message와 MulticastMessage 객체를 만든 뒤 전송하는 코드를 작성해볼게요. 아래 코드에 있는, 이전에 만든 객체들을 사용하겠습니다.

```java
Notification notification = Notification.builder()
        .setTitle("Portugal vs. Denmark")
        .setBody("great match!")
        .build();
			
WebpushFcmOptions webpushOptions = WebpushFcmOptions.withLink("https 경로");

WebpushConfig webpushConfig = WebpushConfig.builder()
        .setFcmOptions(webpushOptions)
        .build();
        
```

1. **Message 객체 생성 및 전송**

```java
Message message = Message.builder()
        .setToken("token")
        .setNotification(notification)
        .setWebpushConfig(webpushConfig)
        .build();

String response = FirebaseMessaging.getInstance().send(message);
```

Message 객체는, 이전에 만든 객체들에 setToken()으로 단일 토큰을 지정하여 전송합니다. 전송에 성공하면 문자열 응답을 보내주는데, 응답은 `projects/{project_id}/messages/{message_id}` 형식으로 이루어져 있습니다.

2. **MulticastMessage 객체 생성 및 전송**

```java
List<String> tokens = new ArrayList<>();

MulticastMessage message = MulticastMessage.builder()
        .addAllTokens(tokens)
        .setNotification(notification)
        .setWebpushConfig(webpushConfig)
        .build();
        
BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(message);
```

MulticastMessage 객체는 **List<String> 에 담긴 모든 토큰**을 **addAllTokens()** 로 추가하는 것 이외에는 Message와 동일합니다. ( +  addToken()을 반복 사용하여 하나씩 추가 할 수도 있습니다! )

전송은 **sendEachForMulticast()** 에 MulticastMessage 를 담아 호출하며, **BatchResponse** 객체를 반환합니다.

```java
class BatchResponseImpl implements BatchResponse {
    private final List<SendResponse> responses;
    private final int successCount;
    ..
}

public final class SendResponse {
    private final String messageId;
    private final FirebaseMessagingException exception;
    ..
}

public final class FirebaseMessagingException extends FirebaseException {
    private final MessagingErrorCode errorCode;
    ..
}
```

BatchResponse의 구성은 위와 같고, 단일 전송과 다른 점은 **실패한 응답**도 기록된다는 것입니다. 이 응답에 대해서는 예외 처리에서 별도로 다뤄볼게요.

### MulticastMessage

MulticastMessage는 메시지를 여러 사용자(토큰)에게 보낼 때 사용할 수 있고, 한 개의 MulticastMessage 객체에는 **최대 500개의 토큰**을 담을 수 있습니다. 

따라서, MulticastMessage를 보내기 위해서는 우선 **토큰을 500개 단위로 쪼개주는 작업**이 필요한데요, 코드는 아래와 같이 작성할 수 있습니다.

```java
private List<List<String>> partitionTokensByBatch(List<String> tokens) {
    List<List<String>> result = new ArrayList<>();
    for (int i = 0; i < tokens.size(); i += 500) {
        result.add(tokens.subList(i, Math.min(i + 500, tokens.size())));
    }
    return result;
}
```

주의하실 점은 MulticastMessage 전송에는 **최소 1개의 토큰이 포함**되어야 하는데요, 따라서 불필요한 작업을 피하기 위해, 아래 코드와 같이 토큰이 비어있는 경우는 바로 종료하도록 할 수 있습니다. 

```java
public void sendMulticastMessage(List<String> tokens) {
    if (tokens.isEmpty()) {
        return;
    }
	
	// 실제 전송 코드..
}
```

지금까지는 예시를 위해 가장 기본이 되는 Message 객체를 다뤘지만, **실제 저는 아래의 이유들로 MulticastMessage 만을 사용하고 있습니다.**

1. 한 명의 회원이 여러 개의 토큰을 가질 수 있다. 즉 회원 정보로 DB에서 토큰을 조회하는 결과는 List 여야 한다.
2. 여러 회원에게 메시지를 보내는 경우도 있다. 즉 1번과 더불어 모든 알림 전송은 **여러 개의 토큰**을 대상으로 한다.
3. 여러 개의 토큰에 알림을 보낼 때는 MulticastMessage가 성능상 유리하다.

성능에서는 당연하게도 차이가 클 수 밖에 없는데, 1,000개의 토큰을 담아 알림을 보내는 상황을 가정해보면

- Message를 이용하는 경우 토큰의 갯수 만큼의 객체 생성과 네트워크 요청이 필요합니다. 즉 1,000개의 토큰이라면 1,000개의 Message 객체 생성과 1,000번의 네트워크 요청이 필요합니다.
- MulticastMessage는 500개씩 전송을 보낼 수 있으므로, 두 개의 MulticastMessage 객체 생성과 두 번의 네트워크 요청이 필요합니다.

실제로 1000개의 토큰으로 테스트를 했을 때, 100배 이상의 시간 차이가 나는 것을 확인할 수 있었습니다.

![sending_test](https://github.com/pricelees/woowa-writing/blob/level4/level4-image/sending_test_result.png)

따라서, **단일 토큰이 확정적인 상황이 아니라면 가급적 MulticastMessage를 이용하는 것이 유리**하고 저도 아래에서 다룰 예외 처리는 사용하고 있는 MulticastMessage에 대해서만 작성하겠습니다.

## 예외 처리

메시지 전송에 실패하면 FirebaseMessagingException이 발생합니다. 이 예외는 `MessagingErrorcode` 라는 에러 코드 Enum을 가지고 있는데요, Enum에 있는 각 예외 코드에 대한 설명은 [공식 문서](https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode?hl=ko)에서 확인하실 수 있습니다.

이전 코드에서는 작성하지 않았지만 send 또는 sendEachForMulticast는 **throws 또는 try-catch를 이용한 예외 처리가 필요**한데요, 자세히 작성하면 분량이 꽤나 길어져서 간단한 가이드라인만 제시 해 보겠습니다.

1. 위에서 간단하게 작성했는데, 토큰에 문제가 있으면 **UNREGISTERED** 라는 에러 코드로 응답합니다. 에러 코드가 이 코드이면 토큰을 삭제하겠습니다.
2. [재시도 처리 공식문서](https://firebase.google.com/docs/cloud-messaging/scale-fcm?hl=ko#handling-retries)에서 제안하는 방법대로, 429와 500번대 오류가 발생하면 재시도합니다.

### BatchResponse

이전에 간단하게 언급했던 BatchResponse는, 모든 전송에 대한 응답을 가지고 있고, 다음의 특징을 가집니다.

1. BatchResponse의 순서는 MulticastMessage를 만들 때 지정한 **토큰의 순서와 동일**합니다.
    - 따라서, BatchResponse의 인덱스를 이용하면 성공 / 실패한 토큰만을 조회할 수 있습니다.
2. getSuccessCount(), getFailureCount()를 통해 성공 / 실패 횟수를 알 수 있습니다.
3. getResponses() 를 통해 List<SendResponse>를 얻을 수 있고, SendResponse안에는 개별 메시지의 id와 예외 발생시의 예외 정보가 들어있습니다.

이제 BatchResponse를 이용한 예외 처리 과정을 본격적으로 다뤄보겠습니다. 

### 예외 핸들링

```java
public void sendMulticastMessage(List<String> tokens) {
    if (tokens.isEmpty()) {
        return;
    }
    
    MulticastMessage message = MulticastMessage.builder()
                .addAllTokens(tokens)
                . // 기타 Notification 등 설정
                .build();
	
    try {
        BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(message);
        handleFailedResponses(batchResponse, tokens);
    } catch (FirebaseMessagingException e) {
        log.error("Failed to send. messaging error code: {} / error code: {}",
                    e.getMessagingErrorCode(), e.getErrorCode()
        );
    }
}

private void handleResponses(BatchResponse batchResponse, List<String> tokens) throws FirebaseMessagingException {
    if (batchResponse.getFailureCount() == 0) {
        return;
    }

    List<SendResponse> responses = batchResponse.getResponses();
    removeAllUnregisteredTokens(responses, tokens);
    sendAllRetryableTokens(responses, tokens);
}
```

기본적인 코드는 위와 같습니다. 토큰을 제거하는 removeAllUnregisteredTokens()와 재시도하는 sendAllRetryableTokens()를 작성해 보겠습니다.

```java
private void removeAllUnregisteredTokens(List<SendResponse> responses, List<String> tokens) {
    List<String> unregisteredTokens = IntStream.range(0, responses.size())
            .filter(i -> isRemovable(responses.get(i)))
            .mapToObj(tokens::get)
            .toList();

    fcmTokenRepository.deleteAllByTokenIn(unregisteredTokens);
}

private boolean isRemovable(SendResponse sendResponse) {
    if (sendResponse.isSuccessful()) {
        return false;
    }

    MessagingErrorCode errorCode = sendResponse.getException().getMessagingErrorCode();
    return errorCode == MessagingErrorCode.UNREGISTERED;
}
```

응답의 에러 코드를 확인한 뒤, UNREGISTERED 인 토큰을 찾아 제거하는 코드입니다. 응답에 해당되는 토큰을 꺼내기 위해 IntStream 을 이용하여 인덱스로 루프를 돌려야 합니다.

> IntStream을 사용할 때는 주의가 필요합니다. List<String>에서 토큰을 지우거나 하는 과정으로 BatchResponse.getResponses()와 갯수가 불일치하는 경우 예외가 발생할 수 있습니다. 
> 

```java
private void sendAllRetryableTokens(List<SendResponse> responses, List<String> tokens) {
        retryFor429Error(responses, tokens);
        retryFor5xxError(responses, tokens);
}
```

재시도 처리는 MessagingErrorCode가 429(QUOTA_EXCEEDED) 일 때와 INTERNAL(500) / UNAVAILABLE(503)인 경우로 나눌 수 있습니다. 토큰 분류는 이전에 토큰을 삭제할 때 했던 방법과 동일합니다.
재시도 처리는 내용이 많기도 하고, 이는 기능 구현보다는 기능 고도화에 가깝다고 생각하여 간단한 가이드만 작성해 보겠습니다.

1. 429 에러인 경우 retry-after 헤더에 있는 시간 뒤에 재시도 요청을 보내고, 값이 없으면 기본값은 60초입니다.

```java
sendResponse.getException().getHttpResponse().getHeaders().get("retry-after");
```

retry-after 값은 `SendResponse`  객체에 위 코드를 적용하여 얻을 수 있습니다.

2. 500번대 에러인 경우 지수 백오프로 재시도 요청을 보냅니다. 지수 백오프는 **재시도 사이의 대기 시간을 점차 늘려가는 방법**입니다.

```java
@Retryable(
        retryFor = FirebaseMessagingException.class,
        maxAttempts = // 최대 재시도 횟수,
        backoff = @Backoff(delay =  // 재시도 사이의 간격, 
                         multiplier = // 다음 재시도 시 현재 대기 시간에 몇 배를 할지,
                         maxDelay = // 최대 대기 시간     
        )
)
```

지수 백오프 방법은 **Spring Retry**나 ScheduledExecutorService를 이용하여 구현할 수 있습니다! 

## 마무리

이번 글에서는 FCM과 토큰 관리, 메시지 전송, 그리고 예외 처리에 대해 알아보았습니다.

알림 기능을 빠르게 구현하고자 한다면 메시지 전송 부분만 참고하시면 됩니다. 알림은 구현 자체만 보면 어렵지는 않으나, `잘` 보내기 위해서는 수많은 고민이 필요합니다. 이 글에서 다룬 토큰 관리, 예외 처리도 그렇고 **트랜잭션, 이벤트별 전송 전략, 의존성, 동기 / 비동기** 등의 애플리케이션 자체에 대한 고민도 필요합니다.

사용자가 많거나, 사용자가 적어도 수 많은 알림을 보내는 상황이 아니라면 예외 처리와 같은 부분은 생략하고 실제 전송 부분만 구현한 뒤 고도화하는 과정을 거치는게 더 의미가 있다고 생각합니다.

> 저희 서비스에서는 초창기 알림 기능을 도입할 때 알림 전송에 실패해도 기존 비즈니스 로직은 유지(=트랜잭션 커밋)하는 정도도 구현하지 않고, 가장 기본적인 전송 기능만 구현했음에도 알림에서의 예외가 거의 발생하지 않았습니다!
> 

이 글이 초기의 알림 기능 구현에 도움이 되었으면 좋겠습니다. 긴 글 읽느라 고생하셨습니다. 감사합니다!
