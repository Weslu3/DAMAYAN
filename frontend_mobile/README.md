# Damayan Mobile Frontend

### Setup Instructions
1. **Navigate to the directory:**
   ```bash
   cd frontend_mobile
   ```

2. **Install all dependencies:**
   ```bash
   npm install
   ```

3. **Run the application:**
    - To run in the **Browser** (Recommended for quick testing):
       ```bash
       npm run web
       ```
    - To run on **Android/iOS (Expo Go on physical phone)**:
       - Install the **Expo Go** app on your phone.
       - Start backend first (gateway on port `3001`).
       - Use LAN bootstrap (recommended):
          ```bash
          npm run start
          ```
       - If LAN does not connect, use tunnel mode:
          ```bash
          npm run start:tunnel
          ```

### Important for Expo Go
- Do **not** run `npx expo start -c` directly for physical-device testing.
- The provided start scripts automatically set `EXPO_PUBLIC_API_BASE_URL` to your PC LAN IP so the phone can reach backend APIs.
- Ensure phone and PC are on the same network (for LAN mode).