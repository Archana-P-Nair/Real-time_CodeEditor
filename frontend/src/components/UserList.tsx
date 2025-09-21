"use client";

import { Users } from 'lucide-react';

interface User {
  id: string;
  username: string;
}

interface UserListProps {
  users: User[];
}

const UserList: React.FC<UserListProps> = ({ users }) => {
  return (
    <div className="bg-gray-700 p-3 rounded-md">
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} className="text-gray-300" />
        <span className="text-sm font-medium text-gray-300">Online Users</span>
        <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
          {users.length}
        </span>
      </div>
      
      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-200">{user.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;