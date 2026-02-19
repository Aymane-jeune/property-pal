import os
import sys
from supabase import create_client, Client

def query_test_table():
    # Use environment variables for sensitive information
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/ANON_KEY must be set.")
        sys.exit(1)

    try:
        supabase: Client = create_client(url, key)
        
        # Query the 'test' table
        print("Querying 'test' table...")
        response = supabase.table("test").select("*").execute()
        
        # In newer supabase-py versions, response is a wrapper
        data = response.data
        
        if data:
            print(f"Successfully retrieved {len(data)} rows:")
            for row in data:
                print(row)
        else:
            print("No data found in 'test' table.")

    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    query_test_table()
