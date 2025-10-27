import nodemailer from 'nodemailer';
import { User } from '../models/User';

// Cấu hình email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

export class EmailService {
  // Gửi email thông báo dời lịch hẹn
  async sendRescheduleNotification(
    buyerId: string, 
    sellerId: string, 
    appointment: any,
    reason: string
  ) {
    try {
      // Lấy thông tin buyer và seller
      const [buyer, seller] = await Promise.all([
        User.findById(buyerId),
        User.findById(sellerId)
      ]);

      if (!buyer || !seller) {
        throw new Error('Không tìm thấy thông tin người dùng');
      }

      const newDate = new Date(appointment.scheduledDate);
      const formattedDate = newDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Nội dung email
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Thông báo dời lịch hẹn ký hợp đồng</h2>
          
          <p>Xin chào <strong>${(buyer as any).name || buyer.email}</strong>,</p>
          
          <p>Chúng tôi thông báo rằng lịch hẹn ký hợp đồng mua bán xe của bạn đã được dời lại do:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Lý do:</strong> ${reason}
          </div>
          
          <p><strong>Lịch hẹn mới:</strong></p>
          <ul>
            <li><strong>Thời gian:</strong> ${formattedDate}</li>
            <li><strong>Địa điểm:</strong> ${appointment.location}</li>
            <li><strong>Loại:</strong> Ký hợp đồng mua bán xe</li>
          </ul>
          
          <p>Vui lòng xác nhận lại lịch hẹn mới này trong ứng dụng.</p>
          
          <p>Trân trọng,<br>
          <strong>Đội ngũ hỗ trợ</strong></p>
        </div>
      `;

      // Gửi email cho buyer
      await transporter.sendMail({
        from: process.env.EMAIL_USERNAME,
        to: buyer.email,
        subject: 'Thông báo dời lịch hẹn ký hợp đồng',
        html: emailContent
      });

      // Gửi email cho seller
      await transporter.sendMail({
        from: process.env.EMAIL_USERNAME,
        to: seller.email,
        subject: 'Thông báo dời lịch hẹn ký hợp đồng',
        html: emailContent.replace((buyer as any).name || buyer.email, (seller as any).name || seller.email)
      });

      console.log('Email thông báo dời lịch đã được gửi cho cả buyer và seller');
      return true;

    } catch (error) {
      console.error('Lỗi gửi email thông báo dời lịch:', error);
      throw error;
    }
  }

  // Gửi email thông báo xác nhận lịch hẹn
  async sendAppointmentConfirmedNotification(
    buyerId: string,
    sellerId: string,
    appointment: any
  ) {
    try {
      const [buyer, seller] = await Promise.all([
        User.findById(buyerId),
        User.findById(sellerId)
      ]);

      if (!buyer || !seller) {
        throw new Error('Không tìm thấy thông tin người dùng');
      }

      const appointmentDate = new Date(appointment.scheduledDate);
      const formattedDate = appointmentDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">Lịch hẹn đã được xác nhận</h2>
          
          <p>Xin chào <strong>${(buyer as any).name || buyer.email}</strong>,</p>
          
          <p>Cả hai bên đã xác nhận lịch hẹn ký hợp đồng mua bán xe:</p>
          
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Thời gian:</strong> ${formattedDate}</p>
            <p><strong>Địa điểm:</strong> ${appointment.location}</p>
            <p><strong>Loại:</strong> Ký hợp đồng mua bán xe</p>
          </div>
          
          <p>Vui lòng có mặt đúng giờ tại địa điểm hẹn.</p>
          
          <p>Trân trọng,<br>
          <strong>Đội ngũ hỗ trợ</strong></p>
        </div>
      `;

      // Gửi email cho cả buyer và seller
      await Promise.all([
        transporter.sendMail({
          from: process.env.EMAIL_USERNAME,
          to: buyer.email,
          subject: 'Lịch hẹn đã được xác nhận',
          html: emailContent
        }),
        transporter.sendMail({
          from: process.env.EMAIL_USERNAME,
          to: seller.email,
          subject: 'Lịch hẹn đã được xác nhận',
          html: emailContent.replace((buyer as any).name || buyer.email, (seller as any).name || seller.email)
        })
      ]);

      console.log('Email thông báo xác nhận lịch hẹn đã được gửi');
      return true;

    } catch (error) {
      console.error('Lỗi gửi email thông báo xác nhận:', error);
      throw error;
    }
  }

  // Gửi email thông báo hủy lịch hẹn
  async sendAppointmentCancelledNotification(
    buyerId: string,
    sellerId: string,
    appointment: any,
    reason: string
  ) {
    try {
      const [buyer, seller] = await Promise.all([
        User.findById(buyerId),
        User.findById(sellerId)
      ]);

      if (!buyer || !seller) {
        throw new Error('Không tìm thấy thông tin người dùng');
      }

      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Lịch hẹn đã bị hủy</h2>
          
          <p>Xin chào <strong>${(buyer as any).name || buyer.email}</strong>,</p>
          
          <p>Chúng tôi thông báo rằng lịch hẹn ký hợp đồng mua bán xe của bạn đã bị hủy do:</p>
          
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc3545;">
            <strong>Lý do:</strong> ${reason}
          </div>
          
          <p><strong>Thông tin giao dịch:</strong></p>
          <ul>
            <li><strong>Thời gian dự kiến:</strong> ${new Date(appointment.scheduledDate).toLocaleDateString('vi-VN')}</li>
            <li><strong>Số lần dời lịch:</strong> ${appointment.rescheduledCount}/${appointment.maxReschedules}</li>
            <li><strong>Trạng thái:</strong> Đã hủy</li>
          </ul>
          
          <p><strong>Tiền cọc đã được hoàn về ví của bạn.</strong></p>
          
          <p>Nếu bạn vẫn quan tâm đến giao dịch này, vui lòng liên hệ với người bán để thỏa thuận lại.</p>
          
          <p>Trân trọng,<br>
          <strong>Đội ngũ hỗ trợ</strong></p>
        </div>
      `;

      // Gửi email cho cả buyer và seller
      await Promise.all([
        transporter.sendMail({
          from: process.env.EMAIL_USERNAME,
          to: buyer.email,
          subject: 'Lịch hẹn đã bị hủy - Tiền cọc đã hoàn',
          html: emailContent
        }),
        transporter.sendMail({
          from: process.env.EMAIL_USERNAME,
          to: seller.email,
          subject: 'Lịch hẹn đã bị hủy',
          html: emailContent.replace((buyer as any).name || buyer.email, (seller as any).name || seller.email)
        })
      ]);

      console.log('Email thông báo hủy lịch hẹn đã được gửi');
      return true;

    } catch (error) {
      console.error('Lỗi gửi email thông báo hủy:', error);
      throw error;
    }
  }

  // Gửi email thông báo có yêu cầu đặt cọc mới cho seller
  async sendDepositRequestEmail(
    sellerId: string,
    buyerInfo: any,
    listingInfo: any,
    depositAmount: number
  ) {
    try {
      const seller = await User.findById(sellerId);
      if (!seller) {
        throw new Error('Không tìm thấy thông tin người bán');
      }

      // Tạo tên sản phẩm từ make, model, year
      const make = listingInfo?.make || '';
      const model = listingInfo?.model || '';
      const year = listingInfo?.year || '';
      const productName = make && model && year 
        ? `${make} ${model} ${year}`.trim()
        : listingInfo?.title || 'sản phẩm';
      
      const buyerName = buyerInfo.fullName || buyerInfo.name || buyerInfo.email;
      const formattedAmount = depositAmount.toLocaleString('vi-VN');

      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">🚗 Có yêu cầu đặt cọc mới</h2>
          
          <p>Xin chào <strong>${(seller as any).fullName || (seller as any).name || seller.email}</strong>,</p>
          
          <p>Bạn có một yêu cầu đặt cọc mới từ người mua:</p>
          
          <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>👤 Người mua:</strong> ${buyerName}</p>
            <p><strong>🚗 Sản phẩm:</strong> ${productName}</p>
            <p><strong>💰 Số tiền đặt cọc:</strong> ${formattedAmount} VND</p>
            <p><strong>📅 Thời gian:</strong> ${new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
          
          <p>Vui lòng đăng nhập vào ứng dụng để xem chi tiết và xác nhận yêu cầu đặt cọc này.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:8081'}notifications" 
               style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Xem yêu cầu đặt cọc
            </a>
          </div>
          
          <p><strong>Lưu ý:</strong> Bạn có 7 ngày để xác nhận yêu cầu đặt cọc này. Sau thời hạn, yêu cầu sẽ tự động hết hạn.</p>
          
          <p>Trân trọng,<br>
          <strong>Đội ngũ hỗ trợ</strong></p>
        </div>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_USERNAME,
        to: seller.email,
        subject: 'Có yêu cầu đặt cọc mới - ' + productName,
        html: emailContent
      });

      console.log('Email thông báo đặt cọc đã được gửi cho seller:', seller.email);
      return true;

    } catch (error) {
      console.error('Lỗi gửi email thông báo đặt cọc:', error);
      throw error;
    }
  }
}

export default new EmailService();
