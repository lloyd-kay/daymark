import { createAuthService } from "./service";
import * as authRepository from "./repository";
import {
  hashOpaqueValue,
  hashPassword,
  verifyPassword,
  generateSessionToken,
} from "./password";

export function authService() {
  return createAuthService({
    ...authRepository,
    hashOpaqueValue,
    hashPassword,
    verifyPassword,
    generateSessionToken,
  });
}
