# MessMate Deployment Guide

This guide covers deploying MessMate to a production Ubuntu server using Docker Compose.

## Prerequisites
- An Ubuntu 22.04+ Server
- Domain Name pointed to the server's IP address
- Docker and Docker Compose installed

## Step 1: Environment Variables
Create a `.env` file in the root of the project:
```env
ENVIRONMENT=production
MONGO_URL=mongodb://mongodb:27017
DB_NAME=messmate_prod
JWT_SECRET=your-secure-random-string
JWT_ALGORITHM=HS256
REDIS_URL=redis://redis:6379

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME="MessMate Support"
```

## Step 2: Bootstrapping the Cluster
Run the orchestrated services:
```bash
docker-compose up -d --build
```
This will start MongoDB, Redis, and the FastAPI backend.

## Step 3: Seeding the Database
To configure the initial Super Admin account, run the seed script from inside the backend container:
```bash
docker exec -it messmate_backend python backend/seed.py
```

## Step 4: Reverse Proxy & HTTPS (Nginx)
Configure Nginx to proxy `api.messmate.app` to port `8000`.
Then use Certbot to secure it:
```bash
sudo certbot --nginx -d api.messmate.app
```
