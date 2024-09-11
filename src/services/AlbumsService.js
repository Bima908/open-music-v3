const { Pool } = require("pg");
const { nanoid } = require('nanoid');
const InvariantError = require("../exceptions/InvariantError");
const NotFoundError = require("../exceptions/NotFoundError");
const { albumMapperResponse } = require("../utils/albumMapperResponse");
const SongsService = require("./SongsService");

class AlbumsService {
  constructor(cacheService) {
    this._pool = new Pool();
    this._songModel = new SongsService();
    this._cacheService = cacheService;
  }

  async addAlbum({ name, year }) {
    const id = nanoid(16);
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    const query = {
      text: 'INSERT INTO albums VALUES($1, $2, $3, $4, $5) RETURNING id',
      values: [id, name, year, createdAt, updatedAt],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Album gagal ditambahkan');
    }
 
    return result.rows[0].id;
  }

  async getAlbums() {
    const result = await this._pool.query('SELECT * FROM albums');
    return result.rows.map(albumMapperResponse);
  }

  async getAlbumById(id) {
    const query = {
      text: 'SELECT * FROM albums WHERE id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);
    const songs = await this._songModel.getSongsByAlbumId(id);

    if (!result.rows.length) {
      throw new NotFoundError('Album tidak ditemukan');
    }

    const albumSongs = result.rows.map(albumMapperResponse)[0];
    albumSongs.songs = songs;
    return albumSongs;
  }

  async editAlbumById(id, { name, year }) {
    const updatedAt = new Date().toISOString();
    const query = {
      text: 'UPDATE albums SET name = $1, year = $2, updated_at = $3 WHERE id = $4 RETURNING id',
      values: [name, year, updatedAt, id],
    };
 
    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
    }

    return result.rows[0];
  }

  async deleteAlbumById(id) {
    const query = {
      text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
      values: [id],
    };
 
    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Album gagal dihapus. Id tidak ditemukan');
    }

    return result.rows[0];
  }

  async uploadCoverAlbumById(id, cover = null) {
    const updatedAt = new Date().toISOString();
    const query = {
      text: 'UPDATE albums SET cover = $1, updated_at = $2 WHERE id = $3 RETURNING id',
      values: [cover, updatedAt, id],
    };
 
    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
    }

    return result.rows[0];
  }

  async userLikeAlbum(album_id, user_id) {
    const id = nanoid(16);
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    await this.validateAlbumLike(album_id, user_id);

    const query = {
      text: 'INSERT INTO user_album_likes(id, user_id, album_id, created_at, updated_at) VALUES($1, $2, $3, $4, $5) RETURNING id',
      values: [id, user_id, album_id, createdAt, updatedAt],
    };
    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Like gagal ditambahkan');
    }
    await this._cacheService.delete(`album:${album_id}`);
    return result.rows[0].id;
  }

  async userUnlikeAlbum(album_id, user_id) {
    const query = {
      text: 'DELETE FROM user_album_likes WHERE album_id = $1 AND user_id = $2 RETURNING id',
      values: [album_id, user_id],
    };
 
    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Like gagal dihapus. Id tidak ditemukan');
    }
    await this._cacheService.delete(`album:${album_id}`);
    return result.rows[0];
  }

  async getLikeAlbum(album_id) {
    try {
      const result = await this._cacheService.get(`album:${album_id}`);
      return {
        likes: parseInt(JSON.parse(result), 10),
        source: 'cache',
      };
    } catch (error) {
      const query = {
        text: 'SELECT COUNT(album_id) as likes FROM user_album_likes WHERE album_id = $1',
        values: [album_id],
      };
  
      const result = await this._pool.query(query);
      if (!result.rows.length) {
        throw new NotFoundError('Album tidak ditemukan');
      }
      await this._cacheService.set(`album:${album_id}`, JSON.stringify(result.rows[0].likes));
      return {
        likes: parseInt(result.rows[0].likes, 10),
        source: 'database',
      };
    }
  }

  async validateAlbumLike(album_id, user_id) {
    const query = {
      text: 'SELECT COUNT(album_id) as likes FROM user_album_likes WHERE album_id = $1 AND user_id = $2',
      values: [album_id, user_id],
    };

    await this.getAlbumById(album_id);

    const result = await this._pool.query(query);
    console.log(result.rows[0]);
    
    if (result.rows[0].likes > 0) {
      throw new InvariantError('Like gagal ditambahkan');
    }
  }
}

module.exports = AlbumsService;
