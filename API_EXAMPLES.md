# דוגמאות API

לכל נקודת קצה: **מה הפרונט שולח** ו**איזה JSON הוא מקבל**. התשובות אמיתיות, משרת הדוגמה שב-`backend/`.
רשימות קוצרו לפריט אחד + `"..."` (חוץ מרשימות קבועות וקצרות, שמוצגות במלואן). ההסבר המלא על כל שדה נמצא ב-[API_CONTRACT.md](API_CONTRACT.md).

## 1. אפשרויות סינון

נטען פעם אחת בפתיחת הדף.

**שולחים**

```http
GET /api/filters/options
```

**מקבלים**

```json
{
  "taskStatus": [
    {"id": "breach", "label": "משימות בחריגה"},
    {"id": "nearBreach", "label": "עתידות לחרוג"},
    {"id": "treatment", "label": "משימות לטיפול"},
    {"id": "paused", "label": "משימות בהשהייה"}
  ],
  "indicatorRating": [
    {"id": "high", "label": "מדדים גבוהים"},
    {"id": "medium", "label": "מדדים בינוניים"},
    {"id": "low", "label": "מדדים נמוכים"}
  ],
  "orgUnits": [{"id": "b0", "label": "לשכת גיוס ירושלים"}, "..."],
  "professionalFields": [
    {"id": "medical", "label": "רפואי - זימונים"},
    {"id": "community", "label": "קהילה"},
    {"id": "individual", "label": "פרט"},
    {"id": "reserves", "label": "עתודות ושוחררים"}
  ],
  "ramadTevelIndications": [
    {"id": "tevel-bureaus", "label": "אינדיקציית רמ\"ד תבל בלשכות גיוס"},
    {"id": "tevel-hq", "label": "אינדיקציית רמ\"ד תבל במפקדה"}
  ],
  "indicatorClassifications": [{"id": "processes", "label": "תהליכים"}, {"id": "routine", "label": "שגרה"}]
}
```

---

## 2. כרטיסי KPI

ארבעת הכרטיסים העליונים. כל קריאה ל-`/dashboard/*` כוללת את אותם פרמטרי סינון.

**שולחים**

```http
GET /api/dashboard/kpis?scope=all&date=2026-11-01&dateGranularity=day
```

**מקבלים**

```json
{
  "score": {"value": 81, "changePct": 1},
  "taskStatus": {
    "total": 971,
    "changePct": 2,
    "segments": [
      {"key": "breach", "label": "בחריגה", "count": 399},
      {"key": "nearBreach", "label": "עתידות לחרוג", "count": 75},
      {"key": "treatment", "label": "לטיפול", "count": 425},
      {"key": "paused", "label": "בהשהייה", "count": 72}
    ]
  },
  "indicatorRating": {
    "total": 160,
    "segments": [
      {"key": "high", "label": "גבוהים", "count": 37},
      {"key": "medium", "label": "בינוניים", "count": 95},
      {"key": "low", "label": "נמוכים", "count": 28}
    ]
  },
  "taskClassification": {
    "total": 971,
    "segments": [
      {"key": "processes", "label": "תהליכים", "count": 679},
      {"key": "routine", "label": "שגרה", "count": 292}
    ]
  }
}
```

---

## 3. מסגרות

הגרף. בלי `parentId` = הרמה העליונה; לחיצה על עמודה שולחת `parentId` שלה.

**שולחים**

```http
GET /api/dashboard/frameworks?scope=all&date=2026-11-01&dateGranularity=day&metric=scores
```

**מקבלים**

```json
{
  "path": [{"id": null, "name": "לשכות"}],
  "items": [
    {
      "id": "b0",
      "name": "לשכת גיוס ירושלים",
      "hasChildren": true,
      "total": 83,
      "breakdown": null,
      "score": 83
    },
    "..."
  ]
}
```

---

## 4. התפתחות היסטורית

הגרף נפתח על ציונים. את קו הממוצע הפרונט מחשב לבד.

**שולחים**

```http
GET /api/dashboard/history?scope=all&date=2026-11-01&dateGranularity=day&metric=scores
```

**מקבלים**

```json
{
  "series": [
    {
      "key": "score",
      "label": "ציון",
      "points": [{"date": "2026-07-04", "value": 79.1}, "..."]
    },
    {
      "key": "parentScore",
      "label": "ציון אב",
      "points": [{"date": "2026-07-04", "value": 79.2}, "..."]
    }
  ]
}
```

---

## 5. טבלת משימות

עץ בכל עומק — `children` רק בשורות שיש להן.

**שולחים**

```http
GET /api/dashboard/tasks?scope=all&date=2026-11-01&dateGranularity=day
```

**מקבלים**

```json
{
  "rows": [
    {
      "id": "b0",
      "name": "לשכת גיוס ירושלים",
      "indicatorId": null,
      "treatment": 60,
      "nearBreach": 9,
      "breach": 40,
      "paused": 9,
      "total": 118,
      "sla": null,
      "weightPct": 0,
      "score": 83,
      "trendPct": 5,
      "hasReport": true,
      "children": [
        {
          "id": "b0-d0",
          "name": "מדור תו\"ם",
          "indicatorId": null,
          "treatment": 20,
          "nearBreach": 3,
          "breach": 14,
          "paused": 1,
          "total": 38,
          "sla": null,
          "weightPct": 0,
          "score": 90,
          "trendPct": 15,
          "hasReport": true,
          "children": [
            {
              "id": "b0-d0-g0",
              "name": "חו\"ל",
              "indicatorId": "ind-b0-d0-g0",
              "treatment": 3,
              "nearBreach": 0,
              "breach": 3,
              "paused": 0,
              "total": 6,
              "sla": 30,
              "weightPct": 3,
              "score": 85,
              "trendPct": 12,
              "hasReport": true,
              "children": null
            },
            "..."
          ]
        },
        "..."
      ]
    },
    "..."
  ]
}
```

---

## 6. פרטי מדד (ⓘ)

נטען בריחוף ראשון על ⓘ.

**שולחים**

```http
GET /api/indicators/ind-b0-d0-g0
```

**מקבלים**

```json
{
  "id": "ind-b0-d0-g0",
  "name": "חו\"ל",
  "description": "מעקב אחר משימות פתוחות במדד \"חו\"ל\"",
  "handling": "לטפל במשימות לפי סדר העדיפויות ולעדכן סטטוס",
  "classification": "שגרה",
  "professionalField": "רפואי - זימונים",
  "penalty": 0,
  "note": "לא ניתן להפיק נתוני זמן אמת בינשוף"
}
```

---

## 7. נתונים לאקסל

כל המשימות של שורה. את קובץ האקסל הדפדפן בונה.

**שולחים**

```http
GET /api/reports/tasks?scope=all&date=2026-11-01&dateGranularity=day&rowId=b0-d0-g0
```

**מקבלים**

```json
{
  "columns": [{"key": "startDate", "label": "תאריך תחילה", "type": "date", "width": null}, "..."],
  "rows": [
    {
      "rowId": "b0-d0-g0",
      "tasks": [
        {
          "startDate": "2026-09-09",
          "runDate": "2026-11-01",
          "handlingDays": 53,
          "daysToBreach": -23,
          "pauseEndDate": null,
          "pauseReason": null,
          "personalNumber": "7685042",
          "track": "פעמי עתידים",
          "corps": "חיל האוויר",
          "major": "הנדסת חשמל",
          "position": "מהנדס/ת מערכות",
          "studyStartDate": "2023-10-01",
          "studyEndDate": "2026-07-30"
        },
        "..."
      ]
    }
  ]
}
```

---

## 8. דוח בתוך המערכת

עמוד אחד מהדוח, אחרי סינון/מיון בשרת (כאן: בחריגה, ממוין לפי ימים לחריגה).

**שולחים**

```http
GET /api/reports/tasks/page?scope=all&date=2026-11-01&dateGranularity=day&rowId=b0&page=1&pageSize=50&taskType=breach&sortKey=daysToBreach&sortDir=asc
```

**מקבלים**

```json
{
  "columns": [{"key": "startDate", "label": "תאריך תחילה", "type": "date", "width": null}, "..."],
  "total": 40,
  "typeCounts": {"breach": 40, "nearBreach": 9, "treatment": 60, "paused": 9},
  "facets": {
    "pauseReason": ["המתנה למסמכים", "ערעור בתהליך", "שהייה בחו\"ל"],
    "track": ["יעד", "פעמי עתידים"],
    "corps": ["אמ\"ן", "..."],
    "major": ["הנדסה אזרחית", "..."],
    "position": ["מהנדס/ת חשמל", "..."]
  },
  "tasks": [
    {
      "startDate": "2026-08-14",
      "runDate": "2026-11-01",
      "handlingDays": 79,
      "daysToBreach": -58,
      "pauseEndDate": null,
      "pauseReason": null,
      "personalNumber": "6389627",
      "track": "יעד",
      "corps": "תקשוב",
      "major": "הנדסת חשמל",
      "position": "מהנדס/ת חשמל",
      "studyStartDate": "2023-10-01",
      "studyEndDate": "2027-07-30",
      "rowId": "b0-d2-g3"
    },
    "..."
  ]
}
```

---

## 9. חיפוש מלש"ב

תוך כדי הקלדה בתיבת החיפוש.

**שולחים**

```http
GET /api/candidates/search?q=כהן
```

**מקבלים**

```json
[{"id": "5251232", "fullName": "אורי כהן", "idNumber": "310053984"}, "..."]
```

---

## 10. המשתמש המחובר

קובע אם להציג את כלי המנהלן.

**שולחים**

```http
GET /api/me
```

**מקבלים**

```json
{"employeeId": "1111111", "fullName": "מנהל מערכת", "isAdmin": true}
```

---

## 11. הודעות

רק הודעות שעוד לא פגו.

**שולחים**

```http
GET /api/announcements
```

**מקבלים**

```json
[
  {
    "id": "welcome",
    "title": "עדכון מערכת",
    "message": "ביום חמישי בין 18:00 ל-20:00 המערכת תהיה בתחזוקה ועשויה לא להיות זמינה.",
    "severity": "warning",
    "createdAt": "2026-11-01T14:27:51.186299Z",
    "expiresAt": "2026-11-08T14:27:51.186302Z",
    "createdBy": {"employeeId": "1111111", "fullName": "מנהל מערכת"}
  }
]
```

---

## 12. יצירת הודעה (מנהלן)

עריכה זהה: `PUT /api/announcements/{id}` עם אותו גוף. למי שאינו מנהלן — 403.

**שולחים**

```http
POST /api/announcements

{
  "title": "עדכון",
  "message": "נוספו מדדים חדשים לתחום הרפואי.",
  "severity": "info",
  "expiresAt": "2026-11-08T21:59:59Z"
}
```

**מקבלים**

```json
{
  "id": "e396d2c755f646a7ac8586152c8fa9f8",
  "title": "עדכון",
  "message": "נוספו מדדים חדשים לתחום הרפואי.",
  "severity": "info",
  "createdAt": "2026-11-01T14:27:51.591894Z",
  "expiresAt": "2026-11-08T21:59:59Z",
  "createdBy": {"employeeId": "1111111", "fullName": "מנהל מערכת"}
}
```

---

## 13. מחיקת הודעה (מנהלן)

מוחקים הודעה. למי שאינו מנהלן — 403.

**שולחים**

```http
DELETE /api/announcements/e396d2c755f646a7ac8586152c8fa9f8
```

**מקבלים**

*(בלי גוף תשובה — סטטוס 204)*
