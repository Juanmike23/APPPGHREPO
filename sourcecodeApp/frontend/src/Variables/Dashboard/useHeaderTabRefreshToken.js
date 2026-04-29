import { useEffect, useRef, useState } from "react";

const useHeaderTabRefreshToken = (activeTab) => {
  const [refreshToken, setRefreshToken] = useState(0);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }

    setRefreshToken((prev) => prev + 1);
  }, [activeTab]);

  return refreshToken;
};

export default useHeaderTabRefreshToken;

