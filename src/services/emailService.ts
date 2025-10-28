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
  // Method hỗ trợ gửi email
  async sendEmail(to: string, subject: string, html: string) {
    await transporter.sendMail({
      from: process.env.EMAIL_USERNAME,
      to,
      subject,
      html
    });
  }

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

  /**
   * Gửi email thông báo người mua đã xác nhận lịch hẹn
   */
  async sendAppointmentConfirmedByBuyerNotification(
    sellerId: string,
    buyerInfo: any,
    appointment: any,
    listingInfo?: any
  ) {
    try {
      const seller = await User.findById(sellerId);
      if (!seller || !seller.email) {
        console.log('Seller không có email hoặc không tồn tại');
        return;
      }

      // Tạo thông tin sản phẩm
      const make = listingInfo?.make || '';
      const model = listingInfo?.model || '';
      const year = listingInfo?.year || '';
      
      const productName = make && model && year 
        ? `${make} ${model} ${year}`.trim()
        : listingInfo?.title || 'sản phẩm';

      // Format ngày giờ
      const appointmentDate = new Date(appointment.scheduledDate);
      const formattedDate = appointmentDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = appointmentDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const subject = `Người mua đã xác nhận lịch hẹn ký hợp đồng - ${productName}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #28a745; margin-top: 0;">✅ Lịch hẹn đã được xác nhận</h2>
            <p style="font-size: 16px; margin-bottom: 0;">Chào ${seller.fullName || seller.email},</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
            <p style="font-size: 16px; line-height: 1.6;">
              <strong>${buyerInfo.fullName || buyerInfo.email}</strong> đã xác nhận lịch hẹn ký hợp đồng mua bán xe <strong>${productName}</strong>.
            </p>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">📅 Thông tin lịch hẹn:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Thời gian:</strong> ${formattedDate} lúc ${formattedTime}</li>
                <li><strong>Địa điểm:</strong> ${appointment.location}</li>
                <li><strong>Sản phẩm:</strong> ${productName}</li>
                <li><strong>Người mua:</strong> ${buyerInfo.fullName || buyerInfo.email}</li>
              </ul>
            </div>
            
            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #0c5460; margin-top: 0;">👥 Thông tin quan trọng:</h3>
              <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                <strong>Tới ngày hôm đó sẽ có nhân viên của chúng tôi đứng ra làm chứng</strong> để đảm bảo giao dịch diễn ra minh bạch và an toàn. 
                Nhân viên sẽ hỗ trợ kiểm tra xe, xác nhận tình trạng và làm chứng cho việc ký kết hợp đồng.
              </p>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">⚠️ Lưu ý:</h3>
              <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
                <li>Vui lòng có mặt đúng giờ tại địa điểm đã hẹn</li>
                <li>Mang theo đầy đủ giấy tờ tùy thân</li>
                <li>Chuẩn bị xe ở tình trạng tốt nhất</li>
                <li>Liên hệ hotline nếu có thay đổi: <strong>1900-xxxx</strong></li>
              </ul>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi. Chúc bạn có một giao dịch thành công!
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #6c757d;">
              Email này được gửi tự động từ hệ thống. Vui lòng không trả lời email này.
            </p>
          </div>
        </div>
      `;

      await this.sendEmail(seller.email, subject, htmlContent);
      console.log(`Email thông báo xác nhận lịch hẹn đã được gửi cho seller: ${seller.email}`);
      
    } catch (error) {
      console.error('Lỗi gửi email thông báo xác nhận lịch hẹn:', error);
      throw error;
    }
  }

  /**
   * Gửi email thông báo người mua đã reject lịch hẹn
   */
  async sendAppointmentRejectedByBuyerNotification(
    sellerId: string,
    buyerInfo: any,
    appointment: any,
    reason: string,
    listingInfo?: any
  ) {
    try {
      const seller = await User.findById(sellerId);
      if (!seller || !seller.email) {
        console.log('Seller không có email hoặc không tồn tại');
        return;
      }

      // Tạo thông tin sản phẩm
      const make = listingInfo?.make || '';
      const model = listingInfo?.model || '';
      const year = listingInfo?.year || '';
      
      const productName = make && model && year 
        ? `${make} ${model} ${year}`.trim()
        : listingInfo?.title || 'sản phẩm';

      // Format ngày giờ đã reject
      const oldDate = new Date(appointment.scheduledDate);
      const formattedOldDate = oldDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedOldTime = oldDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const subject = `Người mua đã từ chối lịch hẹn - ${productName}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #856404; margin-top: 0;">⚠️ Lịch hẹn đã bị từ chối</h2>
            <p style="font-size: 16px; margin-bottom: 0;">Chào ${seller.fullName || seller.email},</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
            <p style="font-size: 16px; line-height: 1.6;">
              <strong>${buyerInfo.fullName || buyerInfo.email}</strong> đã từ chối lịch hẹn ký hợp đồng mua bán xe <strong>${productName}</strong>.
            </p>
            
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <h3 style="color: #721c24; margin-top: 0;">📋 Lý do từ chối:</h3>
              <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                <strong>${reason || 'Người mua không nêu rõ lý do'}</strong>
              </p>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">📅 Lịch hẹn đã bị từ chối:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Thời gian:</strong> ${formattedOldDate} lúc ${formattedOldTime}</li>
                <li><strong>Địa điểm:</strong> ${appointment.location}</li>
                <li><strong>Sản phẩm:</strong> ${productName}</li>
                <li><strong>Người mua:</strong> ${buyerInfo.fullName || buyerInfo.email}</li>
              </ul>
            </div>
            
            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #0c5460; margin-top: 0;">🔄 Bước tiếp theo:</h3>
              <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                Bạn có thể <strong>tạo lịch hẹn mới</strong> phù hợp hơn qua ứng dụng. 
                Người mua sẽ nhận được thông báo và xác nhận lịch hẹn mới.
              </p>
            </div>
            
            <div style="margin: 20px 0; text-align: center;">
              <p style="font-size: 16px; line-height: 1.6;">
                Vui lòng đăng nhập vào ứng dụng để tạo lịch hẹn mới hoặc liên hệ với người mua để thỏa thuận thời gian phù hợp.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #6c757d;">
              Email này được gửi tự động từ hệ thống. Vui lòng không trả lời email này.
            </p>
          </div>
        </div>
      `;

      await this.sendEmail(seller.email, subject, htmlContent);
      console.log(`Email thông báo từ chối lịch hẹn đã được gửi cho seller: ${seller.email}`);
      
    } catch (error) {
      console.error('Lỗi gửi email thông báo từ chối lịch hẹn:', error);
      throw error;
    }
  }
}

export default new EmailService();
