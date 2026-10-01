import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService } from './auth.service.js';
import { RolUsuario } from '@ferreteria/shared';
import { getEnv } from '../config/env.js';
import type { UsuarioRepository } from '../repositories/usuario.repository.js';
import type { Usuario } from '@prisma/client';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUsuarioRepo: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  const mockUser: Usuario = {
    id: 1,
    nombre: 'Admin Test',
    email: 'admin@ferreteria.com',
    passwordHash: '$2b$10$hashedpassword',
    rol: 'ADMIN',
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsuarioRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };

    authService = new AuthService(mockUsuarioRepo as unknown as UsuarioRepository);
  });

  it('debe autenticar al usuario correctamente con credenciales válidas', async () => {
    mockUsuarioRepo.findByEmail.mockResolvedValue(mockUser);
    vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

    const result = await authService.login('admin@ferreteria.com', 'password123');

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('refreshToken');
    expect(result.usuario.email).toBe('admin@ferreteria.com');
    expect(result.usuario.rol).toBe(RolUsuario.ADMIN);
  });

  it('debe lanzar error si la contraseña es incorrecta', async () => {
    mockUsuarioRepo.findByEmail.mockResolvedValue(mockUser);
    vi.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

    await expect(authService.login('admin@ferreteria.com', 'wrongpassword'))
      .rejects.toThrow('Credenciales inválidas');
  });

  it('debe lanzar error si el usuario no existe', async () => {
    mockUsuarioRepo.findByEmail.mockResolvedValue(null);

    await expect(authService.login('noexiste@ferreteria.com', 'pass'))
      .rejects.toThrow('Credenciales inválidas');
  });

  it('debe lanzar error si el usuario está inactivo', async () => {
    const inactiveUser = { ...mockUser, activo: false };
    mockUsuarioRepo.findByEmail.mockResolvedValue(inactiveUser);

    await expect(authService.login('admin@ferreteria.com', 'pass'))
      .rejects.toThrow('Usuario inactivo');
  });

  it('debe renovar el token si el refresh token es válido', async () => {
    mockUsuarioRepo.findById.mockResolvedValue(mockUser);
    const validRefreshToken = jwt.sign(
      { id: mockUser.id, email: mockUser.email, rol: mockUser.rol },
      getEnv().JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const result = await authService.refreshToken(validRefreshToken);
    expect(result).toHaveProperty('token');
  });
});
