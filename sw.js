// 나이 계산기 Service Worker

const KST_OFFSET = 9 * 60 * 60 * 1000;

function getKSTDate() {
    const now = new Date();
    const kst = new Date(now.getTime() + KST_OFFSET + now.getTimezoneOffset() * 60 * 1000);
    return {
        year: kst.getFullYear(),
        month: kst.getMonth(),
        date: kst.getDate(),
        hours: kst.getHours(),
        minutes: kst.getMinutes()
    };
}

function calculateAgeText(birthStr) {
    const kst = getKSTDate();
    const birth = new Date(birthStr + 'T00:00:00');
    const birthYear = birth.getFullYear();
    const birthMonth = birth.getMonth();
    const birthDate = birth.getDate();

    let years = kst.year - birthYear;
    let months = kst.month - birthMonth;
    let days = kst.date - birthDate;
    if (days < 0) { months--; days += new Date(kst.year, kst.month, 0).getDate(); }
    if (months < 0) { years--; months += 12; }

    return `${years}세 ${months}개월 ${days}일`;
}

// 알림 표시
async function showAgeNotification(birthdate) {
    const ageText = calculateAgeText(birthdate);
    await self.registration.showNotification('오늘의 나이', {
        body: `오늘 당신은 ${ageText} 입니다.`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎂</text></svg>',
        tag: 'age-daily',
        renotify: true
    });
}

// 메인 페이지에서 메시지 수신
self.addEventListener('message', (event) => {
    const { type, birthdate } = event.data;
    if (type === 'SHOW_NOTIFICATION' && birthdate) {
        showAgeNotification(birthdate);
    }
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes('index.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('./index.html');
            }
        })
    );
});

// Periodic Background Sync (Chrome PWA)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'age-morning-notification') {
        const kst = getKSTDate();
        // 오전 7:30 ~ 8:30 사이에만 알림
        if (kst.hours === 8 || (kst.hours === 7 && kst.minutes >= 30)) {
            event.waitUntil(
                caches.open('age-calc-data').then(async (cache) => {
                    const resp = await cache.match('birthdate');
                    const birthdate = resp ? await resp.text() : '1984-11-06';
                    return showAgeNotification(birthdate);
                })
            );
        }
    }
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
