"""Settings, read from environment variables (with defaults that work for local development)."""
import os

# Any SQLAlchemy URL. Examples:
#   sqlite:///./shavit.db                                         (default, zero setup)
#   postgresql+psycopg://user:pass@host:5432/shavit                (pip install psycopg[binary])
#   mssql+pyodbc://user:pass@host/shavit?driver=ODBC+Driver+18+for+SQL+Server   (pip install pyodbc)
#   oracle+oracledb://user:pass@host:1521/?service_name=SHAVIT    (pip install oracledb)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shavit.db")

# Must match NEAR_BREACH_DAYS in the frontend's src/config.ts:
# daysToBreach < 0 → בחריגה, 0..N → עתידה לחרוג, > N → לטיפול.
NEAR_BREACH_DAYS = int(os.getenv("NEAR_BREACH_DAYS", "5"))

# Until real login (SSO) is wired in, requests without an X-Employee-Id header act as this user.
DEMO_EMPLOYEE_ID = os.getenv("DEMO_EMPLOYEE_ID", "1111111")

# Only needed when the frontend calls the API directly (not through the Vite dev proxy).
CORS_ORIGINS = [o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o]

# Breadcrumb label for the top level of the מסגרות chart.
FRAMEWORKS_ROOT_NAME = os.getenv("FRAMEWORKS_ROOT_NAME", "לשכות")
