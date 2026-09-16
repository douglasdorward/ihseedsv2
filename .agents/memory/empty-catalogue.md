---
name: Empty catalogue is valid
description: Runtime behavior after an intentional full product-catalogue wipe.
---

An empty product catalogue is a valid administrative state. Normal API reads and service restarts must not create sample or seed products; products should return only through an explicit import, creation action, or intentional seed operation.

**Why:** The owner may wipe all products before a fresh authoritative workbook import. Automatic population makes the wipe unreliable and can contaminate the replacement catalogue.

**How to apply:** Keep sample seeding separate from normal server startup and read paths. When changing catalogue initialization, verify an empty database remains empty after both API access and a service restart.