const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const path = require("path");

const app = express();
const PORT = 8080;

// Middleware 설정
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Google Sheets API 설정
const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = "1PNY8NYdf6Us6ln5UEZ7tcSiuYy2532RxhpufAmHbYH4";

// 사용자 인증 정보 (예제)
const USERS = [
    { id: "admin", password: "1234" },
    { id: "user1", password: "pass1" },
    { id: "user2", password: "pass2" },
];

// ----- 로그인 처리 API -----
app.post("/login", (req, res) => {
    const { id, password } = req.body;

    // 사용자 인증 확인
    const user = USERS.find(user => user.id === id && user.password === password);

    if (user) {
        res.json({ success: true, redirect: "/home" }); // 로그인 성공
    } else {
        res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." }); // 로그인 실패
    }
});

// ----- 데이터 저장 API (form.html) -----
app.post("/submit", async (req, res) => {
    const { category, storeName, customerName, content } = req.body;

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "data1!A1",
            valueInputOption: "RAW",
            resource: {
                values: [[category, storeName, customerName, content]],
            },
        });
        res.send("데이터가 성공적으로 저장되었습니다!");
    } catch (error) {
        console.error("Google Sheets 저장 실패:", error);
        res.status(500).send("데이터 저장 실패");
    }
});

// ----- 야근 기록 저장 API (overtime.html) -----
app.post("/overtime-submit", async (req, res) => {
    const { employeeName, startTime, endTime } = req.body;

    // 총 야근 시간 계산
    const start = new Date(startTime);
    const end = new Date(endTime);
    const totalHours = ((end - start) / (1000 * 60 * 60)).toFixed(2);

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "overtime!A1",
            valueInputOption: "RAW",
            resource: {
                values: [[employeeName, startTime, endTime, totalHours]],
            },
        });
        res.send("야근 기록이 성공적으로 저장되었습니다!");
    } catch (error) {
        console.error("Google Sheets 저장 실패:", error);
        res.status(500).send("야근 기록 저장 실패");
    }
});

// ----- HTML 파일 라우팅 -----
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/form", (req, res) => res.sendFile(path.join(__dirname, "public", "form.html")));
app.get("/home", (req, res) => res.sendFile(path.join(__dirname, "public", "home.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "public", "about.html")));
app.get("/overtime", (req, res) => res.sendFile(path.join(__dirname, "public", "overtime.html")));

// 서버 실행
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
