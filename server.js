const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs"); // fs 모듈 추가

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
    { id: "dsi1", password: "dsi1" },
    { id: "pcy", password: "qkrcodud" },
    { id: "kja", password: "rhkrwlsdn" },
    { id: "kdh", password: "rhkreogns" },
    { id: "pks", password: "qkrrudtjr" },
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

// 로그 파일 경로 설정
const LOG_FILE_PATH = path.join(__dirname, "logs", "form-data.log");

// 일자별 로그 파일 경로 생성 함수
function getLogFilePath() {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD 형식
    return path.join(__dirname, "logs", `form-data-${date}.log`);
}

// 로그 파일에 데이터 기록 함수
function logToFile(status, data, error = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        status, // "success" 또는 "failure"
        data,
        error: error ? error.message : null,
    };

    const logFilePath = getLogFilePath(); // 현재 날짜의 로그 파일 경로 생성

    fs.appendFile(logFilePath, JSON.stringify(logEntry) + "\n", (err) => {
        if (err) {
            console.error("로그 파일 기록 실패:", err);
        } else {
            console.log("로그 파일에 기록되었습니다:", logEntry);
        }
    });
}

app.get("/weekly-category-data", async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "weeklyData!B2:C10",
        });
        const rows = response.data.values || [];
        const data = rows.reduce((acc, [category, count]) => {
            acc[category] = parseInt(count, 10) || 0;
            return acc;
        }, {});
        res.json(data);
    } catch (error) {
        console.error("주간 데이터 조회 실패:", error);
        res.status(500).send("데이터 조회 실패");
    }
});

app.get("/monthly-store-data", async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "monthlyData!B2:C10",
        });
        const rows = response.data.values || [];
        const data = rows.reduce((acc, [store, count]) => {
            acc[store] = parseInt(count, 10) || 0;
            return acc;
        }, {});
        res.json(data);
    } catch (error) {
        console.error("월별 데이터 조회 실패:", error);
        res.status(500).send("데이터 조회 실패");
    }
});

// ----- 데이터 저장 API (form.html) -----
app.post("/submit", async (req, res) => {
    const { category, storeName, customerName, startTime, content, actions, endTime, loggedInUser } = req.body;

    try {
        // 특수 문자 처리
        const sanitizedContent = content.replace(/"/g, '""').replace(/\n/g, '\\n');
        const sanitizedActions = actions.replace(/"/g, '""').replace(/\n/g, '\\n');

        const values = [
            [loggedInUser, category, storeName, customerName, startTime, sanitizedContent, sanitizedActions, endTime]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "data1!A1",
            valueInputOption: "USER_ENTERED",
            resource: { values },
        });

         // 로그 파일에 저장
         logToFile({ category, storeName, customerName, startTime, content, actions, endTime, loggedInUser });

        console.log("Google Sheets에 저장된 데이터:", values);
        res.send("데이터가 성공적으로 저장되었습니다!");
    } catch (error) {
        console.error("Google Sheets 저장 실패:", error);
        res.status(500).send("데이터 저장 실패");
    }
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// Google Sheets 데이터 불러오기 API
app.get("/about-data", async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "data1!A2:H1000", // 데이터 범위 (A2부터 시작)
        });

        const rows = response.data.values || [];
        const data = rows.map(row => ({
            loggedInUser: row[0] || "",
            category: row[1] || "",
            storeName: row[2] || "",
            customerName: row[3] || "",
            startTime: row[4] || "",
            content: row[5] || "",
            actions: row[6] || "",
            endTime: row[7] || "",
        }));

        res.json(data); // 데이터를 JSON 형식으로 반환
    } catch (error) {
        console.error("Google Sheets 데이터 조회 실패:", error);
        res.status(500).send("데이터 조회 실패");
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
            range: "overtime!A2",
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

// ----- 설치일정등록 API (installation.html) -----
app.post("/new-data-submit", async (req, res) => {
    const { storeName, ownerName, product, vanCompany, remoteInterval, installDate, notes } = req.body;

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "installation!A2",
            valueInputOption: "RAW",
            resource: {
                values: [[storeName, ownerName, product, vanCompany, remoteInterval, installDate, notes]],
            },
        });
        res.send("설치일정 등록 완료!");
    } catch (error) {
        console.error("Google Sheets 저장 실패:", error);
        res.status(500).send("설치일정 등록 실패");
    }
});

app.get("/board-data", async (req, res) => {
    try {
        // Google Sheets에서 데이터 가져오기
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, // Google Sheets ID
            range: "board!A2:D1000", // 데이터가 저장된 범위 (A2부터 끝까지)
        });

        const rows = response.data.values || [];

        // 데이터를 JSON 형식으로 변환
        const boardData = rows.map((row, index) => ({
            id: index + 1, // 행 번호를 ID로 사용
            title: row[0] || "", // 제목
            content: row[1] || "", // 내용
            author: row[2] || "", // 작성자
            date: row[3] || "", // 작성일
        }));

        res.json(boardData); // 데이터를 JSON 형식으로 클라이언트에 반환
    } catch (error) {
        console.error("Google Sheets 데이터 가져오기 실패:", error);
        res.status(500).send("게시판 데이터를 가져오는 중 오류가 발생했습니다.");
    }
});


// 게시글 저장 API
app.post("/board-submit", async (req, res) => {
    const { title, content, author, date } = req.body;

    try {
        // Google Sheets에 데이터 추가
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "board!A2", // 시트 이름과 시작 범위
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[title, content, author, date]], // 데이터 배열
            },
        });

        console.log("게시글이 성공적으로 저장되었습니다.");
        res.status(200).send("게시글이 성공적으로 저장되었습니다.");
    } catch (error) {
        console.error("게시글 저장 실패:", error);
        res.status(500).send("게시글 저장 중 오류가 발생했습니다.");
    }
});

async function getSheetData(range) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });
        return response.data.values || []; // 데이터가 없을 경우 빈 배열 반환
    } catch (error) {
        console.error("Google Sheets 데이터 가져오기 오류:", error);
        throw new Error("데이터를 가져오는 중 오류가 발생했습니다.");
    }
}

// ----- HTML 파일 라우팅 -----
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/form", (req, res) => res.sendFile(path.join(__dirname, "public", "form.html")));
app.get("/home", (req, res) => res.sendFile(path.join(__dirname, "public", "home.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "public", "about.html")));
app.get("/overtime", (req, res) => res.sendFile(path.join(__dirname, "public", "overtime.html")));
app.get("/installation", (req, res) => res.sendFile(path.join(__dirname, "public", "installation.html")));
app.get("/board", (req, res) => res.sendFile(path.join(__dirname, "public", "board.html")));

// 서버 실행
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
