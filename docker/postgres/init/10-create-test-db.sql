-- Creates the dedicated test database inside the same PostgreSQL instance.
-- Runs automatically on first container initialization (only when the data
-- volume is empty). The main database `wagering` is created by POSTGRES_DB.
CREATE DATABASE wagering_test OWNER wagering;
