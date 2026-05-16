import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const sendEmail = async (options) => {
    // Check if email config exists, else use Ethereal or just log
    let transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Fallback for demo: just log the email content
        console.log("--- EMAIL MOCK ---");
        console.log(`To: ${options.email}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Message: ${options.message}`);
        console.log("------------------");
        return;
    }

    const message = {
        from: `${process.env.FROM_NAME || 'MediAI Healthcare'} <${process.env.FROM_EMAIL || 'noreply@mediai.com'}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
    };

    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
};

export default sendEmail;
