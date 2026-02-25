---
author: "geoje"
generation: 6
level: "unclassified"
original_filename: "technical.md"
source: "https://github.com/woowacourse/woowa-writing/blob/geoje/technical.md"
source_path: "technical.md"
---

## 목차

| 제목                        | 부제목                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [목표](#목표)               |                                                                                                                                                                                                               |
| [EC2](#ec2)                 | [생성](#생성) \| [연결](#연결)                                                                                                                                                                                |
| [도메인](#도메인)           | [도메인 업체 선정](#도메인-업체-선정) \| [도메인 구매](#도메인-구매) \| [도메인 관리](#도메인-관리) \| [레코드 등록](#레코드-등록) \| [접속 테스트](#접속-테스트)                                             |
| [DDNS 선정](#ddns-선정)     | [Case 1. AWS Elastic IP](#case-1-aws-elastic-ip) \| [Case2. DDNS with Cloudflare API](#case-2-ddns-with-cloudflare-api)                                                                                       |
| [DDNS 자동화](#ddns-자동화) | [스크립트 생성](#스크립트-생성) \| [Cloudflare API Key 발급](#cloudflare-api-key-발급) \| [쉘 스크립트 실행](#쉘-스크립트-실행) \| [부팅 시 실행 구성](#부팅-시-실행-구성) \| [재부팅 테스트](#재부팅-테스트) |
| [Swap Memory](#swap-memory) |                                                                                                                                                                                                               |
| [Nginx](#nginx)             | [설치](#설치) \| [내부 테스트](#내부-테스트) \| [외부 테스트](#외부-테스트) \| [인증서 발급](#인증서-발급) \| [Nginx HTTPS 구성](#nginx-https-구성)                                                           |
| [Docker](#docker)           | [설치](#설치-1) \| [도커 그룹에 등록](#사용자를-도커-그룹에-등록) \| [테스트](#테스트) \| [정적 서버 실행](#정적-서버-실행) \| [정적 서버 테스트](#정적-서버-테스트)                                          |
| [VSCode](#vscode)           | [설치](#설치-2) \| [Extension 설치](#extension-설치) \| [SSH 설정](#ssh-설정) \| [접속 테스트](#접속-테스트-1) \| [도커](#도커)                                                                               |
| [마무리](#마무리)           |                                                                                                                                                                                                               |

## 목표

- `ssh config` 를 적용하여 간략한 명령어로 빠르게 서버에 접속합니다.
  ![](https://velog.velcdn.com/images/chch1213/post/79584000-1088-4ba9-bf2a-7dc1815c813b/image.png)
- `VSCode` 로 `EC2` 에 접속해 파일, Nginx, 도커 등을 편하게 관리합니다.
  ![](https://velog.velcdn.com/images/chch1213/post/868175a7-4c96-4945-8119-f417140f858c/image.png)
- 도메인 구매 후 `Nginx` 를 통해 웹 서버에 `https` 로 접속 가능하도록 구성합니다.
  ![](https://velog.velcdn.com/images/chch1213/post/79cbf76f-f10f-4abb-bf3e-a85a175053e0/image.png)
- `Cloudflare API` 를 사용하여 재부팅 시 매번 바뀌는 `IP` 를 도메인에 자동 업데이트 합니다.
  ![](https://velog.velcdn.com/images/chch1213/post/506fdc39-4e0b-4106-9097-679559fe1be0/image.png)

> #### 알림
>
> 해당 게시글은 개발 서버 제작의 모든 것을 담고 있으므로 호흡이 굉장히 깁니다.
> 따라서 한 큐에 따라하기 보다는 섹션을 적절히 나누어 순차적으로 진행하는 것을 권장합니다!

## EC2

### 생성

![](https://velog.velcdn.com/images/chch1213/post/eacf6fac-ce97-449b-b74a-cbbdfb509628/image.png)

EC2 생성 시 주요한 사항으로 보아야 하는 것은 운영체제, RAM, 스토리지 용량 입니다.

`macOS` 나 `Windows` 도 있지만 라이센스 비용이 비싸므로, 저렴하고 서버관리에 용의한 `Ubuntu` 를 선택하는 것이 좋습니다.

![](https://velog.velcdn.com/images/chch1213/post/469405c8-b39d-45b4-8c68-9e532b72b1cc/image.png)

버전은 출시된 Ubuntu의 최신 LTS 버전을 선택하면 되며 작성 시점 기준 `LTS 24.04` 이었고, 인스턴스 타입에 따라 비용이 다른데 하드웨어 자원을 보고 적절히 선택하시면 됩니다.

저는 `t4g.micro` 를 하기 위해 아키텍처로 `Arm` 을 선택하였습니다.

개발서버인 만큼 최소한의 하드웨어 자원을 사용하려 하였고, 처음 생성 당시에는 사진과 다르게 `AWS` 에서 생성가능한 최소 인스턴스 타입인 `t4g.nano` 에 스토리지도 `8G` 로 시작하였습니다.

하지만 결국 필요한 도커 컨테이너를 여러개(Spring WAS, 모니터링 등 총 6개) 띄우게 되면서 용량과 램이 부족하게 되었고 수정을 통해 `Scale up` 하였습니다.

`AWS EC2` 는 필요 시 하드웨어 자원을 손쉽게 늘릴 수 있으니 첫 시작을 소소하게 이후 필요 시 증진하는 것을 비용적으로도 추천드립니다.

> #### Key file
>
> EC2 생성 도중 `Key pair` 라는 것을 만들게 되며 `.pem` 파일 하나가 다운로드 됩니다.
> `SSH` 접속에 꼭 필요한 파일이니 홈 폴더 아래의 `.ssh` 폴더에 넣어두시거나 로컬의 클라우드 스토리지(Onedrive, iCloud 등) 폴더에 넣어두시는 것을 권장드립니다.

### 연결

해당 게시글에서는 우테코에서 제공해주는 `EC2` 를 사용하기 때문에 웹쉘이 불가능한다던지, 특정 포트에 대해 허용되는 `IP` 가 지정되어있는 등 제약 사항이 많습니다.

이 환경에 맞도록 서버 개발 환경을 설정 할 예정입니다.

우선 터미널을 열고 키 파일과 같은 경로로 가서 아래 명령어로 접속해 봅시다.
`[key-file-name.pem]` 과 `[ip.address]` 자신에 맞는 키파일명과 `EC2` 아이피 주소를 입력합니다.

`[key-file-name.pem]` 은 홈 폴더 아래 `.ssh` 폴더에 두셨다면 `~/.ssh/[파일명.pem]` 을 입력하시면 되고 그 외 다른 경로에 두셨다면 절대 경로로 입력해주시면 됩니다.

`[ip.address]` 는 AWS EC2 의 탭에 `Public IPv4 address` 란을 보시면 아래와 같이 나와있습니다.
![](https://velog.velcdn.com/images/chch1213/post/157d67b3-b357-4dee-a8a2-99a2ee176f56/image.png)

```shell
ssh -i [key-file-name.pem] ubuntu@[ip.address]
```

명령어를 입력한 후 첫줄에 `Welcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0-1013-aws aarch64)` 같은 메세지가 보이고 마지막 줄에 초록색 으로 `ubuntu@ip-[aws-private-ip]:~$` 가 보인다면 접속에 성공한 것입니다.
![](https://velog.velcdn.com/images/chch1213/post/b5678c67-861b-457e-9000-fc994bb02cb1/image.png)

`exit` 명령어로 나가준 뒤 다음 설정을 해봅시다.

## 도메인

이전 단계에서 `[ip.address]` 를 직접 모두 입력하여 접속하는 것이 불편할 뿐더러 `EC2` 가 재부팅 되면 `[ip.address]` 가 변경되어 SSH 연결에 불편함이 있습니다.

또한 웹 서버 접속 시 `https://3.34.42.134` 과 같이 접속하지 않고 `https://dev.pengcook.net` 으로 접속하게 될 것입니다.

이를 적용하기 위해 도메인 구매 후 `EC2` 재부팅 시 `IP` 가 변경되는 것에 대응하기 위해 `DDNS` 까지 적용해보도록 하겠습니다.

### 도메인 업체 선정

먼저 도메인을 어디서 구매할 것인가에 대한 부분을 고민하게 됩니다.

여러 가지 고려 사항이 있지만 아래 2개로 추려보았습니다.

- 호스팅케이알
  - 국내 업체
  - 나름 오랫동안 역사를 가지며 발전해 옴
- Cloudflare
  - DNS 레코드 변경 API 제공
  - 빠른 네임서버 보유 [성능 체크](https://www.dnsperf.com/)

국내에서 꽤나 큰 업체인 호스팅케이알도 좋지만 Cloudflare에선 DNS Record를 API 요청으로 바꿀 수 있다는 것이 큰 장점이었습니다.

또한 Cloudflare는 전국 권에서 꽤나 좋은 성능을 보유한 업체로써 `DNS Resolve` 나 `DNS Propagation` 등에서 빠른 속도를 자랑하여 이를 선택하였습니다.

> **DDNS(Dynamic DNS)란?**
> 인터넷의 IP 주소가 바뀌어도 고정된 도메인 이름으로 접속할 수 있게 해주는 서비스입니다. IP가 바뀔 때마다 자동으로 도메인과 새 IP를 연결해줍니다.

![](https://velog.velcdn.com/images/chch1213/post/f58d168c-7462-4f09-80d7-73f474c26f72/image.png)

이러한 이유를 통해 `Cloudflare` 팀 계정을 만들고 `1/N` 금액을 부담하여 1년 짜리 도메인 `pengcook.net` 을 결제하였습니다.

금액은 `$11.84` 로써 한화 `약 15,000원` 정도 하였습니다.

### 도메인 구매

계정 생성 시 `Account` 설정에 들어가서 최초 1회 이메일 인증을 해야합니다!

이후 아래 Register Domains 탭에서 도메인을 구매할 수 있습니다.
![](https://velog.velcdn.com/images/chch1213/post/7edcefbf-2e42-44a9-b272-5bb3781636f3/image.png)

### 도메인 관리

구매 이후 `Websites` 탭을 들어가 도메인을 클릭합니다.

![](https://velog.velcdn.com/images/chch1213/post/026bef13-983f-43c4-bdc0-b0728463e687/image.png)

관리 편의성을 위해 `Starred` 를 클릭하여 즐겨찾기 등록한 뒤 `DNS Records` 를 클릭합니다.

![](https://velog.velcdn.com/images/chch1213/post/cccacd63-3143-4db0-b5c0-c621b4067cb7/image.png)

### 레코드 등록

`Add record` 버튼을 클릭한 후 아래와 같이 필요한 정보들을 입력한 후 저장합니다.

- `Type A` DNS 레코드에는 여러 타입이 존재하는데 그 중 `A` 타입은 도메인 주소를 IP 로 변환하는 것입니다.
- `Name` 도메인 앞에 `.` 으로 분리되어 붙는 부분을 의미합니다.
  - `dev` 로 할 경우 `dev.pengcook.net` 을 의미합니다.
  - `dev.mon` 일 경우 `dev.mon.pengcook.net` 을 의미합니다.

![](https://velog.velcdn.com/images/chch1213/post/a2a11a36-fda3-46d7-89df-5da360c9ac8f/image.png)

### 접속 테스트

아래 명령어를 그림과 같이 터미널에 입력하면 연결된 IP를 알 수 있는데, 이것이 Cloudflare 에 등록한 것과 동일한지 확인합니다.

```shell
nslookup [domain.address]
```

![](https://velog.velcdn.com/images/chch1213/post/c9f98144-365e-4e5e-850c-77906038c95d/image.png)

동일할 때 까지 명령어 입력을 수 분간 반복한 뒤 같아지면 `IP` 가 아닌 `Domain` 으로 변경된 아래 명령어로 다시 `SSH` 접속을 해봅니다.

```shell
ssh -i [key-file-name.pem] ubuntu@[domain.address]
```

정상 접속이 될 경우 도메인 연결 까지 완료된 것입니다.

## DDNS 선정

AWS EC2 는 인스턴스를 종료했다 다시 실행할 경우 `Public IP Address` 가 변경되는 단점이 있습니다.

도메인을 사용할 경우 아이피 주소가 변경될 때 마다 `Cloudflare` 에 직접 들어가서 수정해주어야 하는 불편함이 있있습니다.
이러한 불편함을 해결하기 위해 아래 2가지 방법이 있습니다.

### Case 1. AWS Elastic IP

EC2 가 재부팅 되어도 항상 같은 `Public IP Address` 를 유지할 수 있는 AWS 서비스인 **탄력적 IP 주소**를 사용할 수도 있습니다.

> #### How does public IPv4 address pricing work? https://aws.amazon.com/vpc/pricing/
>
> You pay an hourly rate for each public IPv4 address used by your AWS account. The bill is calculated in one-second increments, with a minimum of 60 seconds. The price is the same whether the public IPv4 address is in-use public IPv4 addresses that is associated with an AWS resource you own, or an idle public IPv4 addresses in your AWS account not associated with any AWS resources.<br> > **Hourly charge** for In-use Public IPv4 Address **$0.005** > **Hourly charge** for Idle Public IPv4 Address **$0.005**

하지만 나와있다 시피 시간당 $0.005 의 비용이 지불되며, 이는 **30일 기준 $3.6** 이므로 `t4g.nano` 급 인스턴스 하나 비용입니다.

다른 방법 없을까요? 🤔

### Case 2. DDNS with Cloudflare API

EC2 의 `Public IP Address` 가 변경되는 시점은 딱 한가지 **부팅될 때** 이다.
그럼 부팅될 때 도메인의 IP 를 알맞게 바꿔주면 되지 않을까? 라는 의문이 생기고 이를 해결하기 위해 아래 2가지가 필요합니다.

- DNS 업체의 **변경 요청 API**
- **부팅될 때** API 요청

`Cloudflare` 를 선택한 이유 중 하나가 첫번째를 위함이고, 두번째는 `cron` 이란 리눅스 자체 프로그램으로 해결이 가능합니다.

> #### 그럼 무조건 `Case 2` 가 좋은가?
>
> 그렇지만은 않습니다!
> `DNS A Record` 의 `IP` 가 변경되면 다른 `DNS Server`가 다시 `Authoritative DNS Server(Cloudflare)`에 새로운 정보를 요청해야 하는데 이는 `TTL` 이 만료되어 요청을 하게 되어 정보가 전파가 되는 것입니다.
> 따라서, 변경 사항이 전 세계적으로 전파되기 까지는 48시간 까지도 소요될 수 있다고 합니다.

하지만 비용적 측면 이점도 있고, 한국 또는 미국처럼 인터넷 강대국에서는 수 분 내로 굉장히 빠르게 변경 사항이 반영되어 접속이 가능했던 것 같습니다.

따라서 이 `Case 2` 를 선택하여 진행해보았습니다.

## DDNS 자동화

### 스크립트 생성

홈 폴더에 `.cloudflare` 폴더를 만들고 `ddns.sh` 이라는 쉘 스크립트 파일을 실행 권한을 부여하여 `vim` 을 통해 작성합니다.

```shell
# 홈 폴더에 cloudflare 시크릿 폴더를 생성하고 접속
mkdir ~/.cloudflare
cd ~/.cloudflare

# 현재 외부 IP를 cloudflare에 등록하는 쉘 스크립트 작성을 시작
touch ddns.sh
chmod u+x ddns.sh
vim ddns.sh
```

이후 아래 내용을 복사하여 붙여넣은 뒤 **설정 부분** 의 4개의 값을 알맞게 변경해줍니다.

- `CF_API_TOKEN` Cloudflare 의 API 키 (코드 아래쪽에 발급 방법 있음)
- `CF_EMAIL` Cloudflare 로그인 이메일
- `DOMAIN_NAME` Cloudflare 구매한 도메인 주소
- `DNS_A_RECORDS` A Record 주소 (2개 이상일 경우 `,` 로 연결)

```bash
#!/bin/bash

# 설정 부분
CF_API_TOKEN="[ABCDEFGHIJKLMNOPQ_1234567890123456789012]"
CF_EMAIL="[email@gmail.com]"
DOMAIN_NAME="[example.com]"
DNS_A_RECORDS="[dev.example.com,dev.mon.example.com]"

# Zone ID 가져오기
CF_ZONE_ID=$(/usr/bin/curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN_NAME" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "X-Auth-Email: $CF_EMAIL" \
     -H "Content-Type: application/json" | /usr/bin/jq -r '.result[0].id')

if [ -z "$CF_ZONE_ID" ]; then
    echo "Zone ID를 가져오지 못했습니다."
    exit 1
fi

# 현재 IP 주소 가져오기
CURRENT_IP=$(/usr/bin/curl -s http://checkip.amazonaws.com)

# 여러 도메인 처리
IFS=',' read -ra RECORDS <<< "$DNS_A_RECORDS"
for DNS_A_RECORD in "${RECORDS[@]}"; do

    # Record ID 가져오기
    CF_RECORD_ID=$(/usr/bin/curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?name=$DNS_A_RECORD" \
         -H "Authorization: Bearer $CF_API_TOKEN" \
         -H "X-Auth-Email: $CF_EMAIL" \
         -H "Content-Type: application/json" | /usr/bin/jq -r '.result[0].id')

    if [ -z "$CF_RECORD_ID" ]; then
        echo "Record ID를 가져오지 못했습니다: $DNS_A_RECORD"
        continue
    fi

    # Cloudflare에 저장된 기존 IP 주소 가져오기
    EXISTING_IP=$(/usr/bin/curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$CF_RECORD_ID" \
         -H "Authorization: Bearer $CF_API_TOKEN" \
         -H "X-Auth-Email: $CF_EMAIL" \
         -H "Content-Type: application/json" | /usr/bin/jq -r '.result.content')

    # IP 주소가 변경되었는지 확인
    if [ "$CURRENT_IP" == "$EXISTING_IP" ]; then
        echo "IP 주소가 변경되지 않았습니다: $DNS_A_RECORD. 업데이트를 건너뜁니다."
        continue
    fi

    # IP 주소가 변경되었으므로 DNS 레코드 업데이트
    UPDATE_RESULT=$(/usr/bin/curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$CF_RECORD_ID" \
         -H "Authorization: Bearer $CF_API_TOKEN" \
         -H "X-Auth-Email: $CF_EMAIL" \
         -H "Content-Type: application/json" \
         --data '{"type":"A","name":"'$DNS_A_RECORD'","content":"'$CURRENT_IP'","ttl":120,"proxied":false}')

    # 업데이트 결과 확인
    if echo "$UPDATE_RESULT" | /usr/bin/jq -e '.success' >/dev/null; then
        echo "DNS 레코드가 성공적으로 업데이트되었습니다: $DNS_A_RECORD -> $CURRENT_IP"
    else
        echo "DNS 레코드 업데이트 실패: $DNS_A_RECORD -> $UPDATE_RESULT"
    fi

done
```

### Cloudflare API Key 발급

도메인 `Overview` 탭에서 아래로 쪽의 `Get your API token` 을 클릭합니다.
![](https://velog.velcdn.com/images/chch1213/post/5b10240f-33ce-41ee-837e-5788216cff01/image.png)

`Edit zone DNS` 의 `Use template` 클릭

![](https://velog.velcdn.com/images/chch1213/post/6757f483-4a2b-42d3-8715-6d45ba174a83/image.png)

`Zone Resources` 에서 `Include` `Specific zone` `[domain.address]` 선택 이후 아래쪽 `Continue to summary` 버튼 클릭

![](https://velog.velcdn.com/images/chch1213/post/ca494d9a-cf98-464a-9ad1-88ef3bedf8c7/image.png)

![](https://velog.velcdn.com/images/chch1213/post/fc4d3031-0e22-4925-86ff-c099bf19533a/image.png)

`Create Token` 버튼 클릭 후 나오는 키 값을 복사하여 이전 쉘 스크립트에 붙여넣습니다.

![](https://velog.velcdn.com/images/chch1213/post/ae4df069-0840-4dd0-a0b1-da929a0d6f41/image.png)

### 쉘 스크립트 실행

`vim` 과 같은 편집기로 작성이 끝나면 `./ddns.sh` 명령어로 실행해봅니다.

아래와 같이 뜨거나 DNS 레코드가 업데이트 되었다고 하면 성공입니다.

> 만약 `Zone ID` 또는 `Record ID` 를 가져오지 못했다고 뜰 경우 `API` 키가 잘 발급되었는지 확인한 후 글이 너무 오래되어 `Cloudflare API` 구조 가 바뀌었는지 체크해보세요.
> 필자 또한 스크립트는 `ChatGPT` 를 통해 만들었기에 이를 활용해봐도 좋을 것 같아요.

![](https://velog.velcdn.com/images/chch1213/post/5d9bce18-be27-448a-a03c-0a8c7eb0b0ce/image.png)

> 변경되는 테스트를 하기 위해서 `Cloudflare` 에서 `A Record`의 주소를 일부러 다른 것으로 바꾼 뒤 쉘 스크립트를 실행해봐도 좋습니다!

### 부팅 시 실행 구성

이 스크립트는 `EC2` 가 부팅되면 실행되어야 합니다.

아래 명령어로 `cron` 스크립트를 연 뒤 아래 스크립트를 추가합니다.

```shell
crontab -e
```

```shell
@reboot /home/ubuntu/.cloudflare/ddns.sh > /home/ubuntu/.log/ddns.log 2>&1 &
```

![](https://velog.velcdn.com/images/chch1213/post/89b2b73a-0e79-4994-ade1-5cd80a3402a5/image.png)

### 재부팅 테스트

이제 진짜 재부팅 했을 때 변경된 `Public IP Address` 가 `Cloudflare` 에 적용되는지 확인해봅시다.

`EC2` 에서 `Stop instance` 이후 완전 종료가 되었을 때 `Start instance` 를 해줍니다.

![](https://velog.velcdn.com/images/chch1213/post/1b75ea33-109c-4d05-b05d-d83f837c7ad5/image.png)

`EC2` 인스턴스가 완전히 실행되면 **`SSH` 로 도메인 접속이 되는지** 또는 **Cloduflare 에 새로운 IP가 반영 되었는지** 확인해 봅니다.

## Swap Memory

EC2 타입이 `t4g.nano` 일 경우 메모리가 고작 `0.5G`, 타입이 `t4g.micro` 일 경우 `1G` 밖에 되지 않습니다.

현재는 추가로 설치한 프로그램이 없기 때문에 문제가 없지만 이후 아래와 같은 많은 프로그램을 설치하게 되면 작은 메모리를 모두 사용하여 SSH 접속도 안되고, 만약 되더라도 명령어가 입력되지 않는 경우가 생기게 됩니다.

이 때, `Stop instance` 이후 `Start instance` 를 하면 SSH 사용이 가능하긴 한데 매 번 문제가 생길 때 마다 해줄 수도 없는 노릇입니다.

따라서 부족한 메모리를 디스크에서 끌어와 가상 메모리로써 사용하도록 하는 스왑 메모리를 추가해보도록 하겠습니다.

루트 위치 `/` 에 `swapfile` 이라는 메모리로 사용할 파일을 `2G` 짜리로 만듭니다.

> #### 디스크 용량 고려
>
> `df -h` 명령어를 이용해 가용 디스크 용량을 확인하고 다음 작업을 수행해야 합니다.
> 또한 앞으로 새로운 프로그램을 설치할 때 마다 이 명령어를 사용하여 확인한 후 작업을 하는 것이 좋습니다.
> 만약 가용 용량이 적을 경우 인스턴스를 종료한 후 `Volume` 을 확장시켜주는 것이 좋습니다.
> 그렇지 않고 모든 디스크 용량을 다 사용할 경우 `SSH` 로그를 남길 공간도 없어져 정상적인 SSH 사용 조차 힘든 상황이 올 수도 있습니다.
> ![](https://velog.velcdn.com/images/chch1213/post/0bd3b31a-1199-411b-b857-8e3b36ad977d/image.png)

디스크 상황 체크가 되었으면 아래 명령어로 가상 메모리 파일을 생성한 후 스왑 메모리 등록까지 해줍니다.

```shell
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 #스왑 파일 생성
sudo chmod 600 /swapfile #스왑 파일에 올바른 권한 설정
sudo mkswap /swapfile #스왑 파일 포맷
sudo swapon /swapfile #스왑 파일 활성화
```

이후 활성화가 잘 되었는지 아래 명령어로 확인합니다.
해당 명령어는 실제 메모리와 가상 메모리가 어느정도 사용되고 캐싱되고 남았는지 알려줍니다.

```shell
free -vh
```

![](https://velog.velcdn.com/images/chch1213/post/e713dcbf-81ec-4b02-b483-e2271c1f2511/image.png)

이로써 접속과 EC2 운영에 기본적인 설정 작업을 완료되었습니다.

본격적으로 서비스를 실행하여 브라우저로 서버에 접속해보도록 하겠습니다.

## Nginx

개발 서버는 단순 `API Server (Spring Boot)` 만 실행되는 것이 아닌 모니터링 서버 또한 한 EC2에 모두 동작시킬 것이므로 도메인 주소별로 분리하여 2개의 웹 서버를 나누어 접속하도록 하게 해야합니다.

이를 `Reverse Proxy` 라는 개념을 통해 아래 도메인 별 접속을 내부적으로 또 한번 분리시킬 수 있습니다.

- `dev.pengcook.net` -> `API Server (localhost:8080)`
- `dev.mon.pengcook.net` -> `Monitoring Server (localhost:3000)`

### 설치

```shell
sudo apt install nginx -y
```

### 내부 테스트

```shell
curl localhost
```

아래 결과가 나오면 성공입니다!

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Welcome to nginx!</title>
    <style>
      html {
        color-scheme: light dark;
      }
      body {
        width: 35em;
        margin: 0 auto;
        font-family: Tahoma, Verdana, Arial, sans-serif;
      }
    </style>
  </head>
  <body>
    <h1>Welcome to nginx!</h1>
    <p>
      If you see this page, the nginx web server is successfully installed and
      working. Further configuration is required.
    </p>

    <p>
      For online documentation and support please refer to
      <a href="http://nginx.org/">nginx.org</a>.<br />
      Commercial support is available at
      <a href="http://nginx.com/">nginx.com</a>.
    </p>

    <p><em>Thank you for using nginx.</em></p>
  </body>
</html>
```

### 외부 테스트

브라우저를 연 뒤 `http://[domain.address]` 를 입력하여 접속 테스트를 해봅니다.

아래와 같이 Nginx 기본 페이지가 보일 경우 성공이지만 오류코드 또는 타임아웃 등이 발생할 경우 EC2 에서 Inbound 규칙에서 포트가 열려있는지 등을 확인해야 합니다.

![](https://velog.velcdn.com/images/chch1213/post/9007bb24-33af-4ed7-83ec-edc154c5ad23/image.png)

> #### 방화벽
>
> `AWS EC2` 는 `Security Group` 으로 외부 포트를 포트포워딩 해주기 때문에 `Ubuntu` 자체의 방화벽 규칙 `ufw` 와 `iptalbes` 와 같은 설정은 하지 않으셔도 됩니다!

### 인증서 발급

HTTPS 를 적용하기 위해 인증서를 아래 명령어로 발급 받아야 합니다.

`Nginx` 를 통해 발급 받는 것이므로 외부 테스트 까지 완료될 때 실행하면 간편하게 명령어 한 줄로 발급받을 수 있습니다.

이메일 부분과 도메인 부분을 모두 자신에 맞도록 변경한 후 실행하시길 바랍니다.

`sudo certbot certonly --nginx --non-interactive --agree-tos -m [email.@example.com] -d [pengcook.net] -d [dev.pengcook.net] -d [dev.mon.pengcook.net]`

인증서 발급 시도는 시간당 n 회 제한이 있으므로 실패했을 경우 출력 문구를 잘 파악하여 트러블 슈팅 해야합니다.

### Nginx HTTPS 구성

우선 설정 파일 생성과 제거를 편리하게 하기 위해 Nginx 기본 구성 폴더의 권한을 `ubuntu` 로 바꿔줍니다.

이후 홈 폴더에 폴더 링크를 추가한 후 기본 설정 파일을 제거합니다.

```shell
cd ~
sudo chown -r ubuntu:ubuntu /etc/nginx/sites-enabled
ln -s /etc/nginx/sites-enabled nginx
rm nginx/default
```

이후 `A Record`에 맞는 파일명으로 확장자 `.conf` 로 파일을 생성하여 아래 내용을 추가한 후 자신의 상황에 맞는 도메인으로 `[dev.example.com]` 을 수정합니다.

```shell
vim nginx/dev.conf
```

```nginx
server {
        listen 80 default_server;
        server_name [dev.example.com];
        return 308 https://$server_name$request_uri;
}

server {
        listen 443 ssl http2 default_server;
        server_name [dev.example.com];
        ssl_certificate /etc/letsencrypt/live/[dev.example.com]/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/[dev.example.com]/privkey.pem;
        ssl_trusted_certificate /etc/letsencrypt/live/[dev.example.com]/chain.pem;
        ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
        ssl_session_timeout 10m;
        ssl_session_cache shared:SSL:10m;
        ssl_session_tickets off;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
        add_header Strict-Transport-Security max-age=31536000;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;

        ssl_stapling on;
        ssl_stapling_verify on;

        location / {
                proxy_pass http://localhost:8080;
                proxy_http_version 1.1;
                proxy_set_header Connection "";
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_set_header X-Forwarded-Host $host;
        }
}
```

이후 `sudo nginx -s reload` 명령어로 설정 파일을 `nginx` 에 적용시켜주면 끝입니다.

`https://[dev.example.com]` 을 브라우저에 입력하여 `https` 접속이 잘 되는지 확인합니다.

`502 Badgateway` 가 보여도 놀라지 마세요!

주소창을 클릭하여 `https` 가 보일 경우 성공한 것입니다.

![](https://velog.velcdn.com/images/chch1213/post/ef9a5f92-0f53-4327-925c-6116bb467876/image.png)

> #### 502 가 뜨는 이유
>
> Nginx 설정 파일 부분에 `location /` 로 `Reverse Proxy` 를 적용해두었는데 `proxy_pass http://localhost:8080` 설정 값으로 인해 `dev.pengcook.net` 요청이 `localhost:8080` 으로 요청 연결이 되야하는데 `localhost:8080` 을 찾지 못하여 생기는 경우입니다. 이는 이후에 Docker 설치 후 임시로 정적 컨테이너를 열어 연결해 볼 예정입니다!

## Docker

팀원들 간의 환경과 서버의 환경을 모두 동일 시 하기 위해 사용한 도커는 모니터링 프레임워크를 추가하기 위해 4개의 프로그램을 모두 컨테이너로 관리할 수 있다는 장점도 있었습니다.

우선 현재의 상황에서는 웹서버만 필요하므로 빠르게 접속 구성을 해보도록 하겠습니다.

### 설치

우선 도커를 설치해야 하는데 아래 공식 문서의 1, 2번 (3번 X) 만 진행하면 됩니다.

https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository

### 사용자를 도커 그룹에 등록

그리고 조금만 내리다 보면 아래 문구를 확인할 수 있습니다.
많은 사람들이 이 부분은 쉽게 지나쳐 매번 `docker` 명령어를 입력할 때 마다 앞에 `sudo` 를 붙여 실행하는 불편함을 겪고 있는데 [Linux postinstall](https://docs.docker.com/engine/install/linux-postinstall) 링크를 클릭하여 `docker` 그룹에 `ubuntu` 사용자를 추가해주는 작업을 해주도록 합시다. (이 또한 2번 항목만 수행하면 되며, SSH의 경우 접속을 끊었다가 다시 들어가야 그룹 지정이 세션에 업데이트 됩니다.)

![](https://velog.velcdn.com/images/chch1213/post/47b453c8-f812-4d4d-abc8-a55ff0eda4f5/image.png)

### 테스트

여기까지 했을 경우 `docker ps` 명령어를 입력하고 아래 와 같이 보일 경우 성공입니다!

```
ubuntu@ip-10-0-0-67:~$ docker ps
CONTAINER ID  IMAGE  COMMAND  CREATED  STATUS  PORTS  NAMES
```

만약 위 명령어가 동작하지 않고 `sudo docker ps` 명령어는 동작할 경우 **사용자를 도커 그룹에 등록** 부분을 다시 설정 해보시길 바랍니다.

### 정적 서버 실행

아래 명령어로 정적 웹 서버 컨테이너를 실행하여 `Nginx` 가 `localhost:8080` 으로 접속할 수 있도록 서버를 열어줍시다.

```shell
docker run -dp 8080:80 joseluisq/static-web-server
```

### 정적 서버 테스트

명령어 및 웹 브라우저로 내부 외부 테스트를 합니다.

```shell
curl locahost:8080
```

![](https://velog.velcdn.com/images/chch1213/post/d1ae35fb-a107-4b73-84f4-d06e2b1c0d04/image.png)

이로써 사용자가 `https://dev.pengcook.net` 으로 접속 시 아래 과정을 거쳐 웹 서버까지 접속을 하게 됩니다.

1. `dev.pengcook.net` 의 `IP` 를 알아냄
2. `IP` 가 향하는 `AWS EC2` 에 `https` 인 `443` 포트로 접속
3. `EC2 Security Group` 의 `Inbound` 규칙을 통해 접속 허용
4. `EC2` 의 `Nginx` 에 `dev.pengcook.net` 으로 `443` 포트로 접속
5. `Nginx` 는 `localhost:8080` 으로 프록시 패스
6. 도커 컨테이너에 해당하는 `localhost:8080` 은 `static-web-server` 컨테이너 내의 `80` 번 포트의 웹 서버로 최종 연결

## VSCode

터미널로 SSH에 접속하여 서버를 관리하다 보면 점점 귀찮고 힘든 것을 느끼게 됩니다.
`vim` 과 `docker` 가 대표적인 예입니다.

VSCode 를 사용하면 터미널을 계속 사용하되 GUI 기반으로 더욱 편리한 관리를 제공해 줍니다.

### 설치

아래 공식 사이트에서 운영체제에 맞는 설치 파일을 다운 받고 설치를 진행합니다.
https://code.visualstudio.com/download

### Extension 설치

VSCode 를 실행한 뒤 왼쪽 네모 조각 모양을 클릭한 후 아래 확장팩 2가지를 설치해주세요.

- `Remote - SSH`
- `Docker`

![](https://velog.velcdn.com/images/chch1213/post/cd98bfd0-0261-401e-923c-155aca6628bb/image.png)

### SSH 설정

아래와 같이 이동하여 SSH 를 설정 파일을 작성합니다.
![image](https://github.com/user-attachments/assets/010eea56-d373-44f4-8992-2706268e1ea5)

제일 위의 홈 폴더 아래 `.ssh/config` 를 선택해주세요.
![](https://velog.velcdn.com/images/chch1213/post/b10ee3e4-28f2-427c-815e-e7d82b9eea95/image.png)

아래와 같이 작성 및 저장한 후 왼쪽 탭을 새로고침하면 `Host` 로 설정한 이름이 보일 것입니다.

- `Host` SSH 프로필 명 입니다. 최대한 짧게 지으면 터미널에 `ssh pd` 를 입력해 바로 서버에 접속할 수 있습니다.
- `HostName` 도메인 주소 또는 IP 주소
- `User` 해당 운영체제의 계정 명
- `IdentityFile` 키 파일 위치 (macOS 유저의 경우 `\` 대신 `/` 를 사용해야합니다!)
  ![](https://velog.velcdn.com/images/chch1213/post/56e0ebb2-2eb7-4dc9-ba8e-af9bb1096915/image.png)

### 접속 테스트

파일 구성이 완료되었으면 새로고침 한 후 버튼을 눌러 접속하면 됩니다.

![image](https://github.com/user-attachments/assets/48b63785-93e3-48c7-beee-c4c93819a4c9)

최초 연결 시 **지문 등록 yes** 메세지나 **운영체제 선택 Linux** 메세지가 뜰 수 있습니다.

또한 최초 연결 시 서버에 `vscode-server` 를 설치 및 동작하게 되는 시간이 걸리므로 조금 기다려주시면 연결이 됩니다.

위쪽에 `Terminal` 을 클릭하면 SSH 를 연결했을 때와 똑같은 터미널을 사용할 수 있습니다.
![image](https://github.com/user-attachments/assets/1cf5378d-60fb-4d72-8ee8-68613a3ed6e9)

좌측에 폴더를 클릭하여 열 경우 파일 탐색기 처럼 볼 수 있습니다.

![image](https://github.com/user-attachments/assets/622cbccd-6f3c-48ef-a2c9-7746b854c1e1)

![](https://velog.velcdn.com/images/chch1213/post/61cf3c44-8a1f-4086-b6ad-f7ee17af7865/image.png)

이로써 서버를 편리하게 관리하며 웹 서버 접속까지 할 수 있는 환경을 구성하였습니다.

### 도커

`Docker` 확장팩을 설치하여 컨테이너, 이미지, 네트워크, 볼륨 등을 `GUI` 환경으로 편리하게 관리할 수 있게 되었습니다.

> `VSCode` 가 없는 환경에서도 도커 관리가 필요한 경우가 많으므로 `exec` `run` `logs` 등과 같이 관리에 필요한 필수 명령어들은 꼭 외워 두시는 것을 추천드립니다!

![](https://velog.velcdn.com/images/chch1213/post/687bf67f-7226-44d5-a13c-615bbbdd4999/image.png)

### 마무리

우분투는 패키지 업데이트 뿐만 아니라 종종 중요한 보안 업데이트가 있습니다.

따라서, 가끔 서버에 접속하여 `sudo apt update && sudo apt upgrade -y` 를 해주시길 바랍니다.

재부팅이 필요하다고 `*** System restart required ***` 가 보이시면 `sudo reboot` 을 하여 재부팅을 해주시는 것도 필요합니다.
