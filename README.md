# Chat-application-electron-mongo-redis
A simple **Electron-based chat application** with support for multiple chat rooms, user avatars, and message persistence.  
Built using **HTML, CSS, JavaScript**, with **MongoDB** for storing rooms and messages, and **Redis** for fast access.

## Features
- Users can set an **avatar URL** during login
- Messages include `avatarUrl`, `username` and `text`
- Avatars are displayed next to each user’s messages (default avatar if none provided)
- Supports multiple chat rooms:
  - Default room: *Általános* (General)
  - Additional rooms stored in MongoDB (`rooms` collection)
- Users can **create new chat rooms** dynamically
- Room list updates automatically when new rooms are added

## Tech Stack
- Electron
- HTML, CSS (frontend)
- JavaScript (controller + service logic)
- MongoDB (users, rooms, messages)
- Redis (fast operations, caching)
