import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { 
      propertyName, 
      roomNumber, 
      userName, 
      userEmail, 
      userPhone, 
      message,
      propertyId 
    } = req.body;

    // Validate required fields
    if (!propertyName || !roomNumber || !userName || !userEmail) {
      return res.status(400).json({ 
        message: 'Missing required fields: propertyName, roomNumber, userName, userEmail' 
      });
    }

    // Create transporter (using Gmail SMTP as example)
    // In production, use environment variables for email credentials
    const transporter = nodemailer.createTransporter({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email content
    const emailContent = `
      New Room Request Received
      
      Property: ${propertyName}
      Room: ${roomNumber}
      
      User Details:
      Name: ${userName}
      Email: ${userEmail}
      Phone: ${userPhone || 'Not provided'}
      
      Message:
      ${message || 'No additional message provided'}
      
      Property ID: ${propertyId || 'Not specified'}
      
      Request submitted at: ${new Date().toLocaleString()}
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'hello@hyve.sg',
      subject: `Room Request for ${propertyName} - Room ${roomNumber}`,
      text: emailContent,
      html: `
        <h2>New Room Request Received</h2>
        
        <h3>Property Details:</h3>
        <p><strong>Property:</strong> ${propertyName}</p>
        <p><strong>Room:</strong> ${roomNumber}</p>
        
        <h3>User Details:</h3>
        <p><strong>Name:</strong> ${userName}</p>
        <p><strong>Email:</strong> <a href="mailto:${userEmail}">${userEmail}</a></p>
        <p><strong>Phone:</strong> ${userPhone || 'Not provided'}</p>
        
        <h3>Message:</h3>
        <p>${message || 'No additional message provided'}</p>
        
        <hr>
        <p><small>Property ID: ${propertyId || 'Not specified'}</small></p>
        <p><small>Request submitted at: ${new Date().toLocaleString()}</small></p>
      `,
    });

    res.status(200).json({ message: 'Room request sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Failed to send room request' });
  }
}