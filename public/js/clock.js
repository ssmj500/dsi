function startClock() {
    const clockElement = document.getElementById("clock");
    if (!clockElement) return; // clock 요소가 없으면 함수 종료

    setInterval(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const date = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        clockElement.textContent = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
    }, 1000);
}

// 페이지 로드 시 시계 시작
window.addEventListener("load", startClock);