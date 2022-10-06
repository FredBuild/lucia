import type { ServerSession, User } from "../../types.js";
import { hashScrypt } from "../../utils/crypto.js";
import {
    createAccessToken,
    createAccessTokenCookie,
    createRefreshToken,
    createRefreshTokenCookie,
} from "../../utils/token.js";
import type { Context } from "../index.js";

type CreateUser = (
    provider: string,
    identifier: string,
    options: {
        password?: string;
        userData?: Lucia.UserData;
    }
) => Promise<{
    session: ServerSession;
    user: User;
}>;

export const createUserFunction = (context: Context) => {
    const createUser: CreateUser = async (provider, identifier, options) => {
        const providerId = `${provider}:${identifier}`;
        const userData = options.userData || {};
        const userId = await context.generateCustomUserId()
        const [accessToken, accessTokenExpires] = createAccessToken();
        const [refreshToken] = createRefreshToken();
        const hashedPassword = options.password
            ? await hashScrypt(options.password)
            : null;
        const dbUserId = await context.adapter.setUser(userId, {
            providerId,
            hashedPassword: hashedPassword,
            userData: userData,
        });
        const user = {
            userId: dbUserId,
            ...userData
        } as User
        await Promise.all([
            context.adapter.setRefreshToken(refreshToken, user.userId),
            context.adapter.setSession(
                user.userId,
                accessToken,
                accessTokenExpires
            ),
        ]);
        const accessTokenCookie = createAccessTokenCookie(
            accessToken,
            accessTokenExpires,
            context.env === "PROD"
        );
        const refreshTokenCookie = createRefreshTokenCookie(
            refreshToken,
            context.env === "PROD"
        );
        return {
            user: user,
            session: {
                accessToken: [accessToken, accessTokenCookie],
                refreshToken: [refreshToken, refreshTokenCookie],
                cookies: [accessTokenCookie, refreshTokenCookie],
                expires: accessTokenExpires,
                userId: user.userId
            },
        };
    };
    return createUser;
};
