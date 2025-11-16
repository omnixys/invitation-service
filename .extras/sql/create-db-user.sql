CREATE ROLE "invitation" LOGIN PASSWORD 'Omnixys16.11.2025';
CREATE DATABASE "invitation";
-- CREATE DATABASE shadow;
GRANT ALL ON DATABASE "invitation" TO "invitation";
GRANT ALL ON DATABASE shadow TO "invitation";
