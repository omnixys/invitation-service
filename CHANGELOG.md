# 🧾 Changelog

All notable changes in this project will be documented in this file.


## 1.0.0 (2026-05-01)

### ⚠ BREAKING CHANGE

* **Invitation:** - import flow no longer uses local tmp directory
- import now requires storage key instead of uploadId

### 1.0.0

* **1.0.0:** Consolidate CI, add release/docker jobs, cleanup ([](https://github.com/omnixys/invitation-service/commit/aa7f9750ed9e5e844f991fd696364fd6cbe1c932))

### Ci

* **Ci:** change serets.SERVICE to vars.SERVICE ([](https://github.com/omnixys/invitation-service/commit/9a3fdbc5ea29b2aeece78662a5ebbdc128bc1061))
* **Ci:** update CI ([](https://github.com/omnixys/invitation-service/commit/c5cbaa4669316794caae745b1ab09b7ef64eb7e3))

### Invitation

* **Invitation:** Add Valkey adapter, handlers, RSVP refactor ([](https://github.com/omnixys/invitation-service/commit/d20eee53b6dad6323bd176e3184acf78a2803a7c))
* **Invitation:** introduce domain exceptions and improve approval flow validation ([](https://github.com/omnixys/invitation-service/commit/db60b56dba2335dcc60e1735b7164ee8e358934d))
* **Invitation:** implement file-based invitation import using storage service ([](https://github.com/omnixys/invitation-service/commit/d799d6c5f745b0d092713e6fcd751cdb87502427))

### Invitation-service

* **Invitation-service:** implement GraphQL schema, DTOs, inputs and payloads ([](https://github.com/omnixys/invitation-service/commit/862c751561fe1a178bc173ad31c66e9ec77f6cc2))
* **Invitation-service:** implement InvitationService logic and GraphQL resolvers ([](https://github.com/omnixys/invitation-service/commit/8e4a90d2bcf9f6cf6d15daa9a4ca31261bd5f2b4))
* **Invitation-service:** initialize project structure and base configuration ([](https://github.com/omnixys/invitation-service/commit/3d32e2aea709f7e176d41b68d7acdb0cbcfdd829))
* **Invitation-service:** set up PostgreSQL database, schema and Prisma models ([](https://github.com/omnixys/invitation-service/commit/e0945473bde0cd0278c9055601b171a74b3b9c00))

### Jobs

* **Jobs:** update ci jobs ([](https://github.com/omnixys/invitation-service/commit/1c3871148afffc43cb8d9f3f372609141e9ca4d6))

### Other

* **Other:** workflow completed ([](https://github.com/omnixys/invitation-service/commit/2c800c7101a65b4962abb110e236970d58bb9864))
* **Other:** 1.0.0 ([](https://github.com/omnixys/invitation-service/commit/ef649858da4906115414ff0d057e2d72dc232648))
* **Other:** add tests ([](https://github.com/omnixys/invitation-service/commit/0a19bbb7eabd17e138d4c9e0bf0ed6edbd09abb5))
* **Other:** Create deploy.yml ([](https://github.com/omnixys/invitation-service/commit/9fb120f67e4d0587ee26babe3c631259b8a139c7))
* **Other:** init ([](https://github.com/omnixys/invitation-service/commit/d9ba0f368d5f42c785fd0b3232a6cfc6e41ba7d1))
* **Other:** Initial commit ([](https://github.com/omnixys/invitation-service/commit/baf90472f5bc72b25700bc9e7bd2188243dbcd9f))
* **Other:** Merge branch '4-invitation-task-implement-invitationservice-logic-and-graphql-resolvers' ([](https://github.com/omnixys/invitation-service/commit/620bb69e73b6eb62840de50677321a5d52f48f13))
* **Other:** Merge branch 'main' of https://github.com/omnixys/omnixys-invitation-service ([](https://github.com/omnixys/invitation-service/commit/90dfff3c1aa3e5b3c0eb556b0350d6597d368488))
* **Other:** Merge pull request #5 from omnixys/1-invitation-task-initialize-invitation-service-project-structure-and-configuration ([](https://github.com/omnixys/invitation-service/commit/2030a5af40f39253f9cc79eafa1564ad2c7b09a1)), closes [#5](https://github.com/omnixys/invitation-service/issues/5)
* **Other:** Merge pull request #6 from omnixys/2-invitation-task-create-postgresql-user-database-and-initial-schema-for-the-invitation-service ([](https://github.com/omnixys/invitation-service/commit/6ba1be110d9336938c60e5aec4dd0cdbfb47d279)), closes [#6](https://github.com/omnixys/invitation-service/issues/6)
* **Other:** Merge pull request #7 from omnixys/3-invitation-task-implement-graphql-schema-entities-inputs-dtos-and-payloads ([](https://github.com/omnixys/invitation-service/commit/2b16fb1eb4136748f505c00d7cffbcf767933107)), closes [#7](https://github.com/omnixys/invitation-service/issues/7)
* **Other:** Merge pull request #8 from omnixys/4-invitation-task-implement-invitationservice-logic-and-graphql-resolvers ([](https://github.com/omnixys/invitation-service/commit/fbc1777d73617866a4387c43204e55ac9d55737c)), closes [#8](https://github.com/omnixys/invitation-service/issues/8)
* **Other:** Update deploy.yml ([](https://github.com/omnixys/invitation-service/commit/9b4088c4c7d8bf2962914d44dccbde89b761578d))
* **Other:** Update env.ts ([](https://github.com/omnixys/invitation-service/commit/136b5faa63de8f796280a29a4e17353688ebac7f))
* **Other:** update imports ([](https://github.com/omnixys/invitation-service/commit/b56e5fb48f3a59855bb3578feb8dfc7b35dcd718))
* **Other:** Update package.json ([](https://github.com/omnixys/invitation-service/commit/b2d717301da04a3b81366ff572ef701bab1d2ff0))
* **Other:** Update seed.ts ([](https://github.com/omnixys/invitation-service/commit/bdd74152da5906553fe7942bdf43047d6165cd1f))
* **Other:** Update seed.ts ([](https://github.com/omnixys/invitation-service/commit/6766eec3d45187267d2e1475711a1ea949f3abb5))
* **Other:** Update task.yml ([](https://github.com/omnixys/invitation-service/commit/355e8302e23b6a32a0b445dffa522ca91cfd3fc0))

### Prisma

* **Prisma:** update prisma schema ([](https://github.com/omnixys/invitation-service/commit/39d1ed445cbe482a2a913726016cd6405bd4def2))

### Release

* **Release:** v1.0.0 ([](https://github.com/omnixys/invitation-service/commit/6ec8e5502da136a05313db741fb7bf9b69945753))
* **Release:** 1.0.0 [skip ci] ([](https://github.com/omnixys/invitation-service/commit/fc9883d848f4086e11a65f3102e7a49724be9526))
* **Release:** 1.0.1 [skip ci] ([](https://github.com/omnixys/invitation-service/commit/fe522f97c435cd1ec4d867485ec957f5e0e90861))
* **Release:** 1.0.2 [skip ci] ([](https://github.com/omnixys/invitation-service/commit/1a47e331adbfe24393a10efddcd191a8c13d8653))
* **Release:** 1.0.3 [skip ci] ([](https://github.com/omnixys/invitation-service/commit/0e78dca9257d6eac41ffcc778314430f5bb62331))
* **Release:** 1.0.4 [skip ci] ([](https://github.com/omnixys/invitation-service/commit/6bffcba26b902d373bf710a36fe20b43cb291bd6))

### Release-ci

* **Release-ci:** add @semantic-release/npm ([](https://github.com/omnixys/invitation-service/commit/306e19994b728c0546abdec709812b6d6610b28a))
* **Release-ci:** fix Release CI Job ([](https://github.com/omnixys/invitation-service/commit/59c820e6e0649f778d89be012ffaf86d041a47c1))

### Service

* **Service:** update service ([](https://github.com/omnixys/invitation-service/commit/1aaff613e39a4ada5f81a0a91ed580d79608a64d))
* **Service:** Upgrade dependencies and remove legacy modules ([](https://github.com/omnixys/invitation-service/commit/7ecbf204060f355bf07a7c3d1b385f2b90473317))

## <small>1.0.4 (2026-02-26)</small>

* fix(release-ci): add @semantic-release/npm ([306e19994b728c0546abdec709812b6d6610b28a](https://github.com/omnixys/omnixys-invitation-service/commit/306e19994b728c0546abdec709812b6d6610b28a))

## <small>1.0.3 (2026-02-26)</small>

* fix(release-ci): fix Release CI Job ([59c820e6e0649f778d89be012ffaf86d041a47c1](https://github.com/omnixys/omnixys-invitation-service/commit/59c820e6e0649f778d89be012ffaf86d041a47c1))

## <small>1.0.2 (2026-02-25)</small>

* fix(ci): change serets.SERVICE to vars.SERVICE ([9a3fdbc5ea29b2aeece78662a5ebbdc128bc1061](https://github.com/omnixys/omnixys-invitation-service/commit/9a3fdbc5ea29b2aeece78662a5ebbdc128bc1061))
* Merge branch 'main' of https://github.com/omnixys/omnixys-invitation-service ([90dfff3c1aa3e5b3c0eb556b0350d6597d368488](https://github.com/omnixys/omnixys-invitation-service/commit/90dfff3c1aa3e5b3c0eb556b0350d6597d368488))

## <small>1.0.1 (2026-02-25)</small>

* fix(ci): update CI ([c5cbaa4669316794caae745b1ab09b7ef64eb7e3](https://github.com/omnixys/omnixys-invitation-service/commit/c5cbaa4669316794caae745b1ab09b7ef64eb7e3))

## 1.0.0 (2026-02-25)

* feat(invitation-service): implement GraphQL schema, DTOs, inputs and payloads ([862c751561fe1a178bc173ad31c66e9ec77f6cc2](https://github.com/omnixys/omnixys-invitation-service/commit/862c751561fe1a178bc173ad31c66e9ec77f6cc2))
* feat(invitation-service): implement InvitationService logic and GraphQL resolvers ([8e4a90d2bcf9f6cf6d15daa9a4ca31261bd5f2b4](https://github.com/omnixys/omnixys-invitation-service/commit/8e4a90d2bcf9f6cf6d15daa9a4ca31261bd5f2b4))
* feat(invitation-service): initialize project structure and base configuration ([3d32e2aea709f7e176d41b68d7acdb0cbcfdd829](https://github.com/omnixys/omnixys-invitation-service/commit/3d32e2aea709f7e176d41b68d7acdb0cbcfdd829))
* feat(invitation-service): set up PostgreSQL database, schema and Prisma models ([e0945473bde0cd0278c9055601b171a74b3b9c00](https://github.com/omnixys/omnixys-invitation-service/commit/e0945473bde0cd0278c9055601b171a74b3b9c00))
* feat(): workflow completed ([2c800c7101a65b4962abb110e236970d58bb9864](https://github.com/omnixys/omnixys-invitation-service/commit/2c800c7101a65b4962abb110e236970d58bb9864))
* 1.0.0 ([ef649858da4906115414ff0d057e2d72dc232648](https://github.com/omnixys/omnixys-invitation-service/commit/ef649858da4906115414ff0d057e2d72dc232648))
* add tests ([0a19bbb7eabd17e138d4c9e0bf0ed6edbd09abb5](https://github.com/omnixys/omnixys-invitation-service/commit/0a19bbb7eabd17e138d4c9e0bf0ed6edbd09abb5))
* Create deploy.yml ([9fb120f67e4d0587ee26babe3c631259b8a139c7](https://github.com/omnixys/omnixys-invitation-service/commit/9fb120f67e4d0587ee26babe3c631259b8a139c7))
* init ([d9ba0f368d5f42c785fd0b3232a6cfc6e41ba7d1](https://github.com/omnixys/omnixys-invitation-service/commit/d9ba0f368d5f42c785fd0b3232a6cfc6e41ba7d1))
* Initial commit ([baf90472f5bc72b25700bc9e7bd2188243dbcd9f](https://github.com/omnixys/omnixys-invitation-service/commit/baf90472f5bc72b25700bc9e7bd2188243dbcd9f))
* Merge branch '4-invitation-task-implement-invitationservice-logic-and-graphql-resolvers' ([620bb69e73b6eb62840de50677321a5d52f48f13](https://github.com/omnixys/omnixys-invitation-service/commit/620bb69e73b6eb62840de50677321a5d52f48f13))
* Merge pull request #5 from omnixys/1-invitation-task-initialize-invitation-service-project-structure-and-configuration ([2030a5af40f39253f9cc79eafa1564ad2c7b09a1](https://github.com/omnixys/omnixys-invitation-service/commit/2030a5af40f39253f9cc79eafa1564ad2c7b09a1)), closes [#5](https://github.com/omnixys/omnixys-invitation-service/issues/5)
* Merge pull request #6 from omnixys/2-invitation-task-create-postgresql-user-database-and-initial-schema-for-the-invitation-service ([6ba1be110d9336938c60e5aec4dd0cdbfb47d279](https://github.com/omnixys/omnixys-invitation-service/commit/6ba1be110d9336938c60e5aec4dd0cdbfb47d279)), closes [#6](https://github.com/omnixys/omnixys-invitation-service/issues/6)
* Merge pull request #7 from omnixys/3-invitation-task-implement-graphql-schema-entities-inputs-dtos-and-payloads ([2b16fb1eb4136748f505c00d7cffbcf767933107](https://github.com/omnixys/omnixys-invitation-service/commit/2b16fb1eb4136748f505c00d7cffbcf767933107)), closes [#7](https://github.com/omnixys/omnixys-invitation-service/issues/7)
* Merge pull request #8 from omnixys/4-invitation-task-implement-invitationservice-logic-and-graphql-resolvers ([fbc1777d73617866a4387c43204e55ac9d55737c](https://github.com/omnixys/omnixys-invitation-service/commit/fbc1777d73617866a4387c43204e55ac9d55737c)), closes [#8](https://github.com/omnixys/omnixys-invitation-service/issues/8)
* Update deploy.yml ([9b4088c4c7d8bf2962914d44dccbde89b761578d](https://github.com/omnixys/omnixys-invitation-service/commit/9b4088c4c7d8bf2962914d44dccbde89b761578d))
* Update env.ts ([136b5faa63de8f796280a29a4e17353688ebac7f](https://github.com/omnixys/omnixys-invitation-service/commit/136b5faa63de8f796280a29a4e17353688ebac7f))
* update imports ([b56e5fb48f3a59855bb3578feb8dfc7b35dcd718](https://github.com/omnixys/omnixys-invitation-service/commit/b56e5fb48f3a59855bb3578feb8dfc7b35dcd718))
* Update seed.ts ([bdd74152da5906553fe7942bdf43047d6165cd1f](https://github.com/omnixys/omnixys-invitation-service/commit/bdd74152da5906553fe7942bdf43047d6165cd1f))
* Update seed.ts ([6766eec3d45187267d2e1475711a1ea949f3abb5](https://github.com/omnixys/omnixys-invitation-service/commit/6766eec3d45187267d2e1475711a1ea949f3abb5))
* Update task.yml ([355e8302e23b6a32a0b445dffa522ca91cfd3fc0](https://github.com/omnixys/omnixys-invitation-service/commit/355e8302e23b6a32a0b445dffa522ca91cfd3fc0))
* breaking(prisma): update prisma schema ([39d1ed445cbe482a2a913726016cd6405bd4def2](https://github.com/omnixys/omnixys-invitation-service/commit/39d1ed445cbe482a2a913726016cd6405bd4def2))

## <small>1.0.1 (2025-11-07)</small>

- Initial commit ([135641e](https://github.com/omnixys/omnixys-invitation-service/commit/135641e))

## <small>1.0.1 (2025-11-06)</small>

- chore(dev): integrate custom Commitlint formatter with Husky hook ([1cc0034](https://github.com/omnixys/omnixys-invitation-service/commit/1cc0034))

## 1.0.0 (2025-11-06)

- chore(ci): add GPL-3.0-or-later license header to all GitHub workflow files ([4b5488c](https://github.com/omnixys/omnixys-invitation-service/commit/4b5488c))
- chore(dev): integrate Husky pre-commit and commit-msg hooks for code quality ([261f18f](https://github.com/omnixys/omnixys-invitation-service/commit/261f18f))
- Initial commit ([7c74f0b](https://github.com/omnixys/omnixys-invitation-service/commit/7c74f0b))
- Update CHANGELOG.md ([e8b2951](https://github.com/omnixys/omnixys-invitation-service/commit/e8b2951))
- Update package.json ([f180269](https://github.com/omnixys/omnixys-invitation-service/commit/f180269))
