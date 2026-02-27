import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOAD_DIR = process.cwd() + '/uploads';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUploadDirs() {
    await mkdir(join(UPLOAD_DIR, 'covers'), { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'tracks'), { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'articles'), { recursive: true });
  }

  async saveCover(buffer: Buffer, mime: string): Promise<string> {
    await this.ensureUploadDirs();
    let ext = '.jpg';
    if (mime === 'image/png') ext = '.png';
    else if (mime === 'image/webp') ext = '.webp';
    const name = `${randomUUID()}${ext}`;
    const path = join(UPLOAD_DIR, 'covers', name);
    await writeFile(path, buffer);
    return `/uploads/covers/${name}`;
  }

  async saveTrackAudio(buffer: Buffer, ext: string): Promise<string> {
    await this.ensureUploadDirs();
    const safeExt = ['.mp3', '.m4a', '.wav', '.ogg'].includes(ext.toLowerCase()) ? ext : '.mp3';
    const name = `${randomUUID()}${safeExt}`;
    const path = join(UPLOAD_DIR, 'tracks', name);
    await writeFile(path, buffer);
    return `/uploads/tracks/${name}`;
  }

  async saveArticleImage(buffer: Buffer, mime: string): Promise<string> {
    await this.ensureUploadDirs();
    let ext = '.jpg';
    if (mime === 'image/png') ext = '.png';
    else if (mime === 'image/webp') ext = '.webp';
    const name = `${randomUUID()}${ext}`;
    const path = join(UPLOAD_DIR, 'articles', name);
    await writeFile(path, buffer);
    return `/uploads/articles/${name}`;
  }

  // --- Sections ---
  async createSection(dto: CreateSectionDto) {
    return this.prisma.contentSection.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findAllSections(type?: string) {
    return this.prisma.contentSection.findMany({
      where: type ? { type } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { tracks: true } } },
    });
  }

  async findSectionById(id: string) {
    const s = await this.prisma.contentSection.findUnique({
      where: { id },
      include: { tracks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!s) throw new NotFoundException('Section not found');
    return s;
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    await this.findSectionById(id);
    return this.prisma.contentSection.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.slug != null && { slug: dto.slug }),
        ...(dto.type != null && { type: dto.type }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteSection(id: string) {
    await this.findSectionById(id);
    return this.prisma.contentSection.delete({ where: { id } });
  }

  // --- Tracks ---
  async createTrack(dto: CreateTrackDto) {
    return this.prisma.contentTrack.create({
      data: {
        sectionId: dto.sectionId,
        title: dto.title,
        descriptionShort: dto.descriptionShort ?? '',
        coverUrl: dto.coverUrl ?? null,
        audioUrl: dto.audioUrl ?? null,
        level: dto.level ?? null,
        isPremium: dto.isPremium ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findTracks(sectionId?: string, type?: string) {
    const where: { sectionId?: string; section?: { type: string } } = {};
    if (sectionId) where.sectionId = sectionId;
    if (type) where.section = { type };
    return this.prisma.contentTrack.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: [{ section: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      include: { section: { select: { id: true, name: true, slug: true, type: true } } },
    });
  }

  async findTrackById(id: string) {
    const t = await this.prisma.contentTrack.findUnique({
      where: { id },
      include: { section: true },
    });
    if (!t) throw new NotFoundException('Track not found');
    return t;
  }

  async updateTrack(id: string, dto: UpdateTrackDto) {
    await this.findTrackById(id);
    return this.prisma.contentTrack.update({
      where: { id },
      data: {
        ...(dto.sectionId != null && { sectionId: dto.sectionId }),
        ...(dto.title != null && { title: dto.title }),
        ...(dto.descriptionShort != null && { descriptionShort: dto.descriptionShort }),
        ...(dto.coverUrl != null && { coverUrl: dto.coverUrl }),
        ...(dto.audioUrl != null && { audioUrl: dto.audioUrl }),
        ...(dto.level != null && { level: dto.level }),
        ...(dto.isPremium != null && { isPremium: dto.isPremium }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteTrack(id: string) {
    await this.findTrackById(id);
    return this.prisma.contentTrack.delete({ where: { id } });
  }

  // --- Articles ---
  async createArticle(dto: CreateArticleDto) {
    return this.prisma.article.create({
      data: {
        blockType: dto.blockType,
        title: dto.title,
        descriptionShort: dto.descriptionShort ?? '',
        descriptionFull: dto.descriptionFull ?? null,
        imageUrl: dto.imageUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findArticles(blockType?: string) {
    return this.prisma.article.findMany({
      where: blockType ? { blockType } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findArticleById(id: string) {
    const a = await this.prisma.article.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Article not found');
    return a;
  }

  async updateArticle(id: string, dto: UpdateArticleDto) {
    await this.findArticleById(id);
    return this.prisma.article.update({
      where: { id },
      data: {
        ...(dto.blockType != null && { blockType: dto.blockType }),
        ...(dto.title != null && { title: dto.title }),
        ...(dto.descriptionShort != null && { descriptionShort: dto.descriptionShort }),
        ...(dto.descriptionFull != null && { descriptionFull: dto.descriptionFull }),
        ...(dto.imageUrl != null && { imageUrl: dto.imageUrl }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteArticle(id: string) {
    await this.findArticleById(id);
    return this.prisma.article.delete({ where: { id } });
  }

  // --- App: home aggregate ---
  async getHome() {
    const [sections, featured, recommended, emergency] = await Promise.all([
      this.prisma.contentSection.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          tracks: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, descriptionShort: true, coverUrl: true, audioUrl: true, level: true, isPremium: true, sortOrder: true } },
        },
      }),
      this.prisma.article.findFirst({ where: { blockType: 'FEATURED' }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.article.findMany({ where: { blockType: 'RECOMMENDED' }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.article.findMany({ where: { blockType: 'EMERGENCY' }, orderBy: { sortOrder: 'asc' } }),
    ]);
    return {
      sections,
      home: {
        featured: featured ?? null,
        recommended: recommended ?? [],
        emergency: emergency ?? [],
      },
    };
  }
}
