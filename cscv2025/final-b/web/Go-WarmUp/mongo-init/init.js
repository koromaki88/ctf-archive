db = db.getSiblingDB('go-warmup');
db.createCollection("users");
db.users.insertOne({
    username: "bob",
    password: "$2a$10$Z8JpR2uX5FZfZKqQF3IJeOZpPQu0Qk9Q/2rH3dzOEPFjULpwl6gT2",
    role: "guest",
    createdAt: new Date(),
    age: 30,
    phone: "000-000-0000",
    address: "CSCV2025{^[0-9a-f]{32}$}"
});

print("MongoDB initialization complete");
