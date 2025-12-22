import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
    baseURL: "http://localhost:8010", // Backend auth server URL
    fetchOptions: {
        credentials: "include", // Send cookies with requests
    },
});