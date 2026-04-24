// Redirect to RootRedirect which handles routing
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PlaceholderIndex = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/");
  }, [navigate]);
  return null;
};

const Index = PlaceholderIndex;

export default Index;
