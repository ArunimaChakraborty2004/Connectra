import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function CommunityDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/communities?community=${id}`, { replace: true });
    } else {
      navigate('/communities', { replace: true });
    }
  }, [id, navigate]);

  return null;
}
