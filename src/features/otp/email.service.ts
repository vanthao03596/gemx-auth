import nodemailer from 'nodemailer';
import { InternalServerError } from '../../utils/errors';

/**
 * Simple email service for sending OTP codes
 * Following KISS principle with basic SMTP configuration
 */
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send OTP code via email
   * @param email Target email address
   * @param code 6-digit OTP code
   */
  async sendOtpEmail(email: string, code: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Your Login Code',
        text: `Your OTP code is: ${code}. This code is valid for 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Login Code</h2>
            <p>Your OTP code is:</p>
            <div style="font-size: 24px; font-weight: bold; color: #007bff; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p>This code is valid for 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      // In development, don't fail on email send errors for testing purposes
      if (process.env.NODE_ENV === 'development') {
        console.log(`OTP code for ${email}: ${code} (email sending disabled in development)`);
        return;
      }
      throw new InternalServerError('Failed to send verification email');
    }
  }

  /**
   * Verify SMTP connection (useful for health checks)
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP connection failed:', error);
      return false;
    }
  }
}