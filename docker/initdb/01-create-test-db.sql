-- Creates a second database for running the backend test suite against,
-- so tests never touch the same data as local dev.
CREATE DATABASE bookflow_test OWNER bookflow;
