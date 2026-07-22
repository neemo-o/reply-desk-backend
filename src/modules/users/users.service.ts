import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async softDelete(id: string) {
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }
}
