# SilentCheckmate Server Deployment Guide

This guide provides instructions for deploying the SilentCheckmate server with PostgreSQL database integration on Render.

## Prerequisites

- A Render account (https://render.com)
- A GitHub repository with your SilentCheckmate code

## Step 1: Set Up PostgreSQL Database on Render

1. Log in to your Render dashboard
2. Click on "New" and select "PostgreSQL"
3. Fill in the following details:
   - Name: `silentcheckmate-db` (or your preferred name)
   - Database: `silentcheckmate`
   - User: Leave as default
   - Region: Choose the region closest to your users
   - PostgreSQL Version: 15 (recommended)
4. Click "Create Database"
5. Once created, note the following information from the database dashboard:
   - Internal Database URL (for connecting from other Render services)
   - External Database URL (for connecting from outside Render)
   - Username
   - Password

## Step 2: Initialize Database Schema

1. Connect to your PostgreSQL database using a client like psql, pgAdmin, or the Render shell
2. Run the SQL commands from `schema.sql` to create the necessary tables:
   ```sql
   -- Users table: stores user information and ELO ratings
   CREATE TABLE IF NOT EXISTS users (
     id BIGSERIAL PRIMARY KEY,
     username TEXT UNIQUE NOT NULL CHECK (length(username) BETWEEN 3 AND 32),
     email TEXT UNIQUE,
     password_hash TEXT NOT NULL,
     elo INTEGER NOT NULL DEFAULT 1200,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   -- Refresh tokens table: for token rotation & revocation
   CREATE TABLE IF NOT EXISTS refresh_tokens (
     id BIGSERIAL PRIMARY KEY,
     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     revoked_at TIMESTAMPTZ
   );

   -- Index for faster token lookups by user
   CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

   -- Match history table: records game results and ELO changes
   CREATE TABLE IF NOT EXISTS matches (
     id BIGSERIAL PRIMARY KEY,
     white_player_id BIGINT NOT NULL REFERENCES users(id),
     black_player_id BIGINT NOT NULL REFERENCES users(id),
     winner_id BIGINT REFERENCES users(id),
     result TEXT NOT NULL CHECK (result IN ('white_win', 'black_win', 'draw')),
     white_elo_before INTEGER NOT NULL,
     black_elo_before INTEGER NOT NULL,
     white_elo_change INTEGER NOT NULL,
     black_elo_change INTEGER NOT NULL,
     game_pgn TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   -- Indexes for match history lookups
   CREATE INDEX IF NOT EXISTS idx_matches_white_player ON matches(white_player_id);
   CREATE INDEX IF NOT EXISTS idx_matches_black_player ON matches(black_player_id);
   ```

## Step 3: Deploy the SilentCheckmate Server

1. From your Render dashboard, click on "New" and select "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - Name: `silentcheckmate-server`
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Select the appropriate plan
4. Add the following environment variables:
   - `PORT`: 10000 (Render will automatically set this, but you can specify it)
   - `NODE_ENV`: production
   - `DATABASE_URL`: (Copy the Internal Database URL from your PostgreSQL service)
   - `JWT_SECRET`: (Generate a secure random string)
   - `REFRESH_SECRET`: (Generate another secure random string)
5. Click "Create Web Service"

## Step 4: Testing the Deployment

1. Once deployed, test the server by accessing the health check endpoint:
   - `https://your-service-name.onrender.com/health`
2. Test the authentication endpoints:
   - Register: POST to `/api/auth/register` with username and password
   - Login: POST to `/api/auth/login` with username and password
3. Test the WebSocket connection for the chess game

## Step 5: Updating the Client

1. Update your client-side code to point to the new server URL
2. Ensure the client is using secure WebSocket connections (wss://)
3. Deploy the updated client to Render or your preferred hosting service

## Troubleshooting

- **Database Connection Issues**: Verify that the DATABASE_URL environment variable is correct and that the database is accessible from your web service.
- **Authentication Errors**: Check that JWT_SECRET and REFRESH_SECRET are properly set.
- **CORS Errors**: Ensure that your server's CORS configuration includes your client's domain.

## Maintenance

- Regularly backup your PostgreSQL database
- Monitor server logs for errors
- Update dependencies as needed to address security vulnerabilities
