import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
        role: registerDto.role,
      },
    });

    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
      },
      {
        secret: refreshSecret,
        expiresIn: '7d',
      },
    );

    const { password, ...userWithoutPassword } = user;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userWithoutPassword,
    };
  }

  async refresh(refreshToken: string) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
      }>(refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newAccessToken = await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        access_token: newAccessToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
