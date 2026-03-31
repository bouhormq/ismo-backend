import { Role } from '@prisma/client';
import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const LoginUser = z.strictObject({
  username: z.string().min(1, {
    message: 'Identifiant est requis',
  }),
  password: z.string().min(1, {
    message: 'Mot de passe est requis',
  }),
});

export const RegisterUser = z.strictObject({
  username: z.string().min(1, {
    message: 'Identifiant est requis',
  }),
  password: z.string().min(1, {
    message: 'Mot de passe est requis',
  }),
  role: z.nativeEnum(Role),
});

export const RequestVerificationCode = z.strictObject({
  username: z.string().min(1, {
    message: 'Identifiant est requis',
  }),
});

export const CheckVerificationCode = z.strictObject({
  username: z.string().min(1, {
    message: 'Identifiant est requis',
  }),
  code: z.string().min(1, {
    message: 'Code de vérification est requis',
  }),
});

export const ResetPassword = z.strictObject({
  username: z.string().min(1, {
    message: 'Identifiant est requis',
  }),
  password: z.string().min(1, {
    message: 'Mot de passe est requis',
  }),
  confirmPassword: z.string().min(1, {
    message: 'Confirmer le mot de passe est requis',
  }),
  otp: z.string().min(1, {
    message: 'Code de vérification est requis',
  }),
});

export class CreateUserDto extends createZodDto(RegisterUser) {}

export class LoginUserDto extends createZodDto(LoginUser) {}

export class RequestVerificationCodeDto extends createZodDto(
  RequestVerificationCode,
) {}

export class CheckVerificationCodeDto extends createZodDto(
  CheckVerificationCode,
) {}

export class ResetPasswordDto extends createZodDto(ResetPassword) {}

export const ChangePassword = z.strictObject({
  currentPassword: z.string().min(1, {
    message: 'Mot de passe actuel est requis',
  }),
  newPassword: z.string().min(1, {
    message: 'Nouveau mot de passe est requis',
  }),
  confirmNewPassword: z.string().min(1, {
    message: 'Confirmation du nouveau mot de passe est requis',
  }),
});

export class ChangePasswordDto extends createZodDto(ChangePassword) {}
