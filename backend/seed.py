"""
Creates the tables and fills them with realistic example data, so the API (and the
dashboard on top of it) can be tried without a real database.

    python seed.py            # (re)creates shavit.db

Safe to re-run: it drops and recreates every table.
"""
import random
from datetime import date, datetime, timedelta

from app.db import Base, SessionLocal, engine
from app.models import (
    Announcement, Candidate, Framework, FrameworkScore, Indicator, ProfessionalField,
    RamadTevelIndication, Task, User,
)

random.seed(42)
TODAY = date.today()

PROFESSIONAL_FIELDS = [("medical", "רפואי - זימונים"), ("community", "קהילה"), ("individual", "פרט"), ("reserves", "עתודות ושוחררים")]
RAMAD_TEVEL = [("tevel-bureaus", 'אינדיקציית רמ"ד תבל בלשכות גיוס'), ("tevel-hq", 'אינדיקציית רמ"ד תבל במפקדה')]
BUREAUS = ["ירושלים", "תל השומר", "חיפה", "באר שבע", "טבריה", "נתניה", "אשדוד", "ראשון לציון"]
DEPARTMENTS = ['מדור תו"ם', "מדור מיון", "מדור קליטה"]
GROUPS = ['חו"ל', 'או"ם', "מיצוי", "השתמטות", "זימון", "צווי 12"]

FIRST = ["נועה", "איתי", "מאיה", "יונתן", "תמר", "אורי", "שירה", "דניאל", "רוני", "עומר", "יעל", "אלון", "ליה", "גיא", "הילה"]
LAST = ["כהן", "לוי", "מזרחי", "פרץ", "ביטון", "אברהם", "פרידמן", "שפירא", "דהן", "אזולאי", "גבאי", "חדד"]
TRACKS = ["יעד", "פעמי עתידים"]
CORPS = ["חיל האוויר", "חיל הים", 'אמ"ן', "תקשוב", "הנדסה קרבית", "שריון"]
MAJORS = ["הנדסת חשמל", "הנדסת מכונות", "מדעי המחשב", "הנדסת תעשייה וניהול", "הנדסה אזרחית"]
POSITIONS = ["מהנדס/ת מערכות", "קצין/ת תקשוב", "מפתח/ת תוכנה", "מהנדס/ת חשמל", "מנהל/ת פרויקטים"]
PAUSE_REASONS = ["המתנה למסמכים", "ועדה רפואית", 'שהייה בחו"ל', "ערעור בתהליך"]


def build_frameworks(db):
    """A tree of any depth. Leaves get an indicator, an SLA and tasks."""
    order = iter(range(10_000))
    leaves = []

    def add(fid, name, parent=None, scope="bureaus", leaf=False):
        fw = Framework(id=fid, name=name, parent_id=parent, scope=scope, sort_order=next(order))
        if leaf:
            ind = Indicator(
                id=f"ind-{fid}",
                name=name,
                description=f'מעקב אחר משימות פתוחות במדד "{name}"',
                handling="לטפל במשימות לפי סדר העדיפויות ולעדכן סטטוס",
                classification=random.choice(["processes", "processes", "routine"]),
                professional_field_id=random.choice(PROFESSIONAL_FIELDS)[0],
                ramad_tevel_id=RAMAD_TEVEL[0][0] if scope == "bureaus" else RAMAD_TEVEL[1][0],
                penalty=random.choice([0, 0, 5, 10]),
                note=random.choice([None, None, "לא ניתן להפיק נתוני זמן אמת בינשוף"]),
            )
            db.add(ind)
            fw.indicator_id = ind.id
            fw.sla_days = random.choice([14, 21, 30, 45])
            fw.weight_pct = random.choice([2, 3, 5, 8])
            leaves.append(fw)
        db.add(fw)
        return fid

    # לשכות → מדורים → קבוצות
    for b, bureau in enumerate(BUREAUS):
        bid = add(f"b{b}", f"לשכת גיוס {bureau}")
        for d, dep in enumerate(DEPARTMENTS):
            did = add(f"b{b}-d{d}", dep, bid)
            for g, group in enumerate(GROUPS):
                add(f"b{b}-d{d}-g{g}", group, did, leaf=True)

    # מפקדה: a five-level branch — ענף → מדור → משרד → צוות → מדד
    anaf = add("anaf", "ענף כוח אדם", scope="hq")
    for m, madur in enumerate(["מדור גיוס", "מדור קליטה"]):
        mid = add(f"anaf-m{m}", madur, anaf, "hq")
        for o, office in enumerate(["משרד ירושלים", "משרד חיפה"]):
            oid = add(f"anaf-m{m}-o{o}", office, mid, "hq")
            for t, team in enumerate(["צוות מיון", "צוות רפואה"]):
                tid = add(f"anaf-m{m}-o{o}-t{t}", team, oid, "hq")
                for i, ind in enumerate(["ראיונות אישיים", "בדיקות רפואיות"]):
                    add(f"anaf-m{m}-o{o}-t{t}-i{i}", ind, tid, "hq", leaf=True)
    return leaves


def build_scores(db, leaves):
    """Monthly scores for the last 13 months. Parents get their children's average; ציון אב = parent's score."""
    months = [TODAY.replace(day=1) - timedelta(days=30 * i) for i in reversed(range(13))]
    frameworks = {f.id: f for f in db.query(Framework).all()}
    children = {}
    for f in frameworks.values():
        children.setdefault(f.parent_id, []).append(f)

    for m in months:
        scores = {}
        for leaf in leaves:
            scores[leaf.id] = max(35, min(100, random.gauss(80, 12)))

        def score(fid):
            if fid not in scores:
                kids = [score(k.id) for k in children.get(fid, [])]
                scores[fid] = sum(kids) / len(kids)
            return scores[fid]

        for fid in frameworks:
            score(fid)
        for fid, f in frameworks.items():
            parent = scores.get(f.parent_id) if f.parent_id else sum(scores[r.id] for r in children[None]) / len(children[None])
            db.add(FrameworkScore(framework_id=fid, day=m, score=round(scores[fid], 1), parent_score=round(parent, 1)))


def build_people_and_tasks(db, leaves):
    candidates = []
    for i in range(1500):
        start = date(TODAY.year - random.randint(1, 3), 10, 1)
        c = Candidate(
            personal_number=str(5_000_000 + i * 2617),
            id_number=str(300_000_000 + i * 104_729)[:9],
            full_name=f"{random.choice(FIRST)} {random.choice(LAST)}",
            track=random.choice(TRACKS),
            corps=random.choice(CORPS),
            major=random.choice(MAJORS),
            position=random.choice(POSITIONS),
            study_start=start,
            study_end=date(start.year + random.choice([3, 4]), 7, 30),
        )
        candidates.append(c)
        db.add(c)
    db.flush()

    for n in range(9000):
        leaf = random.choice(leaves)
        start = TODAY - timedelta(days=random.randint(0, 400))
        handled = random.randint(1, 80)
        end = start + timedelta(days=handled)
        paused = random.random() < 0.06
        db.add(Task(
            framework_id=leaf.id,
            personal_number=random.choice(candidates).personal_number,
            start_date=start,
            end_date=end if end < TODAY or random.random() < 0.3 else None,
            sla_days=leaf.sla_days,
            pause_end_date=TODAY + timedelta(days=random.randint(2, 30)) if paused else None,
            pause_reason=random.choice(PAUSE_REASONS) if paused else None,
            is_parent=random.random() < 0.15,
        ))


def main():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add_all([ProfessionalField(id=i, name=n) for i, n in PROFESSIONAL_FIELDS])
        db.add_all([RamadTevelIndication(id=i, name=n) for i, n in RAMAD_TEVEL])
        db.add_all([
            User(employee_id="1111111", full_name="מנהל מערכת", is_admin=True),
            User(employee_id="7654321", full_name="משתמש לדוגמה", is_admin=False),
        ])
        leaves = build_frameworks(db)
        db.flush()
        build_scores(db, leaves)
        build_people_and_tasks(db, leaves)
        db.add(Announcement(
            id="welcome",
            title="עדכון מערכת",
            message="ביום חמישי בין 18:00 ל-20:00 המערכת תהיה בתחזוקה ועשויה לא להיות זמינה.",
            severity="warning",
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7),
            created_by_id="1111111",
        ))
        db.commit()
        print(f"Seeded: {db.query(Framework).count()} frameworks, {db.query(Task).count()} tasks, "
              f"{db.query(Candidate).count()} candidates.")


if __name__ == "__main__":
    main()
