---
description: how to run the python script that queries the test table
---

# Querying the Test Table Workflow

This workflow describes how to run the Python script that queries the `test` table in your Supabase database.

### Prerequisites

1.  **Python installed**: Ensure you have Python 3.8+ installed.
2.  **Environment Variables**: You need your Supabase credentials.
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`)

### Steps

1.  **Install dependencies**:
    ```bash
    pip install -r scripts/requirements.txt
    ```

2.  **Set Environment Variables**:
    In your terminal (PowerShell for Windows):
    ```powershell
    $env:SUPABASE_URL = "your-supabase-url"
    $env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
    ```

3.  **Run the script**:
    ```bash
    python scripts/query_test_table.py
    ```

### GitHub Actions Integration

A GitHub Actions workflow is also available in `.github/workflows/query-test-table.yml`. To use it on GitHub:
1.  Go to your repository **Settings** > **Secrets and variables** > **Actions**.
2.  Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Repository secrets.
3.  The workflow will run on every push to `main` or can be triggered manually via the **Actions** tab.
