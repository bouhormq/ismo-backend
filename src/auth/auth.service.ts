import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon from 'argon2';
import * as lodash from 'lodash';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../integrations/mail/mail.service';
import { getS3Url } from '../utils/functions/misc.functions';
import { ChangePasswordDto, LoginUserDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(data: LoginUserDto) {
    const user = await this.db.user.findFirst({
      where: {
        username: data.username,
      },
    });

    if (!user) {
      throw new HttpException(
        "L'utilisateur n'a pas été trouvé",
        HttpStatus.NOT_FOUND,
      );
    }

    let finalUser: User;

    if (!finalUser) {
      const verified = await argon.verify(user.password, data.password);
      if (!verified) {
        throw new HttpException(
          "Le mot de passe ou l'adresse n'est pas correct",
          HttpStatus.BAD_REQUEST,
        );
      }
      finalUser = user;
    }

    return {
      user: lodash.omit(finalUser, ['password']),
    };
  }

  async signToken(user: { [key: string]: any }) {
    const payload = {
      sub: user.id,
      email: `${user.email}`,
    };
    if (!user) return;
    return this.jwtService.signAsync(payload, {
      expiresIn: '1y',
      secret: this.config.get('JWT_SECRET'),
    });
  }

  async deleteUser(id: number) {
    return await this.db.user.delete({
      where: {
        id: id,
      },
    });
  }

  async getMyUserData(user: User) {
    if (!user)
      throw new HttpException(
        "L'utilisateur n'a pas été trouvé",
        HttpStatus.NOT_FOUND,
      );

    const dbUser = await this.db.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return null;

    return {
      ...lodash.omit(dbUser, ['password']),
      profileImageUrl: dbUser.profileImageUrl ? getS3Url(dbUser.profileImageUrl) : null,
    };
  }

  async changePassword(user: User, data: ChangePasswordDto) {
    const dbUser = await this.db.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new HttpException(
        "L'utilisateur n'a pas été trouvé",
        HttpStatus.NOT_FOUND,
      );
    }

    const verified = await argon.verify(dbUser.password, data.currentPassword);
    if (!verified) {
      throw new HttpException(
        'Mot de passe incorrect',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (data.newPassword !== data.confirmNewPassword) {
      throw new HttpException(
        'Les mots de passe ne correspondent pas',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashedPassword = await argon.hash(data.newPassword);

    await this.db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return { message: 'Mot de passe modifié avec succès' };
  }

  async forgotPassword(username: string) {
    const user = await this.db.user.findFirst({
      where: { username },
    });

    if (!user) {
      return { message: 'Si ce compte existe, un email a été envoyé.' };
    }

    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    const hashedPassword = await argon.hash(tempPassword);

    await this.db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.mailService.send({
      sender: { email: 'info@ismomat.fr', name: 'ISMO CRM' },
      to: [{ email: 'bouhormq@gmail.com', name: 'Admin' }],
      subject: `Réinitialisation de mot de passe - ${user.username}`,
      htmlContent: `
        <p>Bonjour,</p>
        <p>Voici les informations de connexion pour l'utilisateur <strong>${user.name}</strong> :</p>
        <ul>
          <li><strong>Nom d'utilisateur :</strong> ${user.username}</li>
          <li><strong>Nouveau mot de passe temporaire :</strong> ${tempPassword}</li>
        </ul>
        <p>Veuillez vous connecter et changer votre mot de passe dès que possible.</p>
        <p>Meilleures salutations,<br/>ISMO CRM</p>
      `,
    });

    return { message: 'Si ce compte existe, un email a été envoyé.' };
  }
}
