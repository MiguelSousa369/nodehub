import path from 'path';
import winston from 'winston';

const LOG_DIR = path.resolve(__dirname, '../../logs');
const fileOptions = { maxsize: 10 * 1024 * 1024, maxFiles: 5, tailable: true };

const logger = winston.createLogger({
  level : process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'app.log'), ...fileOptions }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error', ...fileOptions }),
  ],
});

if (process.env.NODE_ENV !== 'test') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }));
}

export default logger;
