import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(createTaskDto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        userId: createTaskDto.userId,
      },
    });
  }

  findAll() {
    return this.prisma.task.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }
}
