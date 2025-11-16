-- Active: 1762704691875@@127.0.0.1@5432@user
CREATE SCHEMA IF NOT EXISTS "user" AUTHORIZATION "user";
ALTER ROLE "user" SET search_path = 'user';