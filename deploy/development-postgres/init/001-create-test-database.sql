SELECT 'CREATE DATABASE ngapd_test OWNER ngapd'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ngapd_test')\gexec
