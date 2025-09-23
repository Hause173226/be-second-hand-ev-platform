import userService from "../services/userService.js";

class UserController {
  // CREATE - Tạo user mới
  async createUser(req, res, next) {
    try {
      const user = await userService.createUser(req.body);

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  // READ - Lấy tất cả users
  async getAllUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();

      res.status(200).json({
        success: true,
        message: "Users retrieved successfully",
        data: users,
        count: users.length,
      });
    } catch (error) {
      next(error);
    }
  }

  // READ - Lấy user theo ID
  async getUserById(req, res, next) {
    try {
      const user = await userService.getUserById(req.params.id);

      res.status(200).json({
        success: true,
        message: "User retrieved successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  // UPDATE - Cập nhật user
  async updateUser(req, res, next) {
    try {
      const user = await userService.updateUser(req.params.id, req.body);

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE - Xóa user
  async deleteUser(req, res, next) {
    try {
      const user = await userService.deleteUser(req.params.id);

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
