CREATE ROLE "user" LOGIN PASSWORD 'Omnixys15.11.2025';
CREATE DATABASE "user";
CREATE DATABASE shadow;
GRANT ALL ON DATABASE "user" TO "user";
GRANT ALL ON DATABASE shadow TO "user";


drop role "user";