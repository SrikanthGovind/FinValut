import {AppDataSource} from '../config/database/data-source'
import { DataSource } from 'typeorm';

export const initializeDatabase = async (): Promise<DataSource> => {
    try {
      await AppDataSource.initialize();
      console.log('Database connection established successfully.');
      return AppDataSource;
    } catch (error) {
      console.error(`Error in D/B connection: ${error}`);
      throw error;
    }
  };
  