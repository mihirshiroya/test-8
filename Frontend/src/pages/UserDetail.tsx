
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import {
  getUserById,
  updateUser,
  updateUserRole,
  deactivateUser,
  activateUser,
  deleteUser,
  clearCurrentUser
} from '../store/slices/adminSlice';
import { ArrowLeft, Save, Shield, Ban, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from '../lib/toast';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentUser, isLoading } = useAppSelector((state) => state.admin);
  const { user: loggedInUser } = useAppSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'USER' as 'USER' | 'ADMIN',
    isActive: true
  });

  useEffect(() => {
    if (loggedInUser?.role !== 'ADMIN') {
      navigate('/dashboard');
      return;
    }
    if (id) {
      dispatch(getUserById(id));
    }
    return () => {
      dispatch(clearCurrentUser());
    };
  }, [dispatch, id, loggedInUser, navigate]);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        email: currentUser.email,
        role: currentUser.role,
        isActive: currentUser.isActive
      });
    }
  }, [currentUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSave = async () => {
    if (!id) return;
    
    try {
      await dispatch(updateUser({ userId: id, data: formData })).unwrap();
      toast.success('User updated', { description: 'Your changes have been saved.' });
      setIsEditing(false);
    } catch (error: any) {
      toast.apiError(error, 'Could not update user');
    }
  };

  const handleRoleChange = async (newRole: 'USER' | 'ADMIN') => {
    if (!id) return;
    
    if (window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      try {
        await dispatch(updateUserRole({ userId: id, role: newRole })).unwrap();
        toast.success('Role updated', { description: `This user is now ${newRole === 'ADMIN' ? 'an admin' : 'a standard user'}.` });
      } catch (error: any) {
        toast.apiError(error, 'Could not update role');
      }
    }
  };

  const handleDeactivate = async () => {
    if (!id) return;
    
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      try {
        await dispatch(deactivateUser(id)).unwrap();
        toast.success('User deactivated', { description: 'They can no longer sign in.' });
      } catch (error: any) {
        toast.apiError(error, 'Could not deactivate user');
      }
    }
  };

  const handleActivate = async () => {
    if (!id) return;
    
    try {
      await dispatch(activateUser(id)).unwrap();
      toast.success('User activated', { description: 'They can sign in again.' });
    } catch (error: any) {
      toast.apiError(error, 'Could not activate user');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await dispatch(deleteUser(id)).unwrap();
        toast.success('User deleted', { description: 'The account has been permanently removed.' });
        navigate('/admin/users');
      } catch (error: any) {
        toast.apiError(error, 'Could not delete user');
      }
    }
  };

  if (isLoading || !currentUser) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isOwnAccount = loggedInUser?.id === currentUser.id;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/users')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Details</h1>
            <p className="text-gray-600 mt-1">View and manage user information</p>
          </div>
        </div>
        <div className="flex gap-3">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit User
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">User Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              {isEditing ? (
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{currentUser.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              {isEditing ? (
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{currentUser.lastName}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{currentUser.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                currentUser.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {currentUser.role}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                currentUser.provider === 'GOOGLE' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {currentUser.provider}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Verified</label>
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                currentUser.isEmailVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {currentUser.isEmailVerified ? 'Verified' : 'Not Verified'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Status</label>
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                currentUser.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {currentUser.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Joined</label>
              <p className="text-gray-900">{new Date(currentUser.createdAt).toLocaleDateString()}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Updated</label>
              <p className="text-gray-900">{new Date(currentUser.updatedAt).toLocaleDateString()}</p>
            </div>

            {currentUser.lastLoginAt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Login</label>
                <p className="text-gray-900">{new Date(currentUser.lastLoginAt).toLocaleString()}</p>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Save className="h-5 w-5" />
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  if (currentUser) {
                    setFormData({
                      firstName: currentUser.firstName,
                      lastName: currentUser.lastName,
                      email: currentUser.email,
                      role: currentUser.role,
                      isActive: currentUser.isActive
                    });
                  }
                }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          
          <div className="space-y-3">
            {!isOwnAccount && currentUser.role !== 'ADMIN' && (
              <button
                onClick={() => handleRoleChange('ADMIN')}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Shield className="h-5 w-5" />
                Promote to Admin
              </button>
            )}

            {!isOwnAccount && currentUser.role === 'ADMIN' && (
              <button
                onClick={() => handleRoleChange('USER')}
                className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <Shield className="h-5 w-5" />
                Demote to User
              </button>
            )}

            {!isOwnAccount && currentUser.isActive && (
              <button
                onClick={handleDeactivate}
                className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              >
                <Ban className="h-5 w-5" />
                Deactivate User
              </button>
            )}

            {!isOwnAccount && !currentUser.isActive && (
              <button
                onClick={handleActivate}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-5 w-5" />
                Activate User
              </button>
            )}

            {!isOwnAccount && (
              <button
                onClick={handleDelete}
                className="w-full bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-5 w-5" />
                Delete User
              </button>
            )}

            {isOwnAccount && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  You cannot perform administrative actions on your own account.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetail;
