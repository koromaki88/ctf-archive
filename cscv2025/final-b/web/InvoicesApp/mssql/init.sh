#!/bin/bash
set -e

/opt/mssql/bin/sqlservr &
echo "Waiting for SQL Server to be ready..."
sleep 20
echo "Running init.sql..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrong!Passw0rd' -C -i /init.sql
echo "Initialization complete. Keeping SQL Server running..."
wait
