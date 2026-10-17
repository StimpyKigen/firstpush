import React from 'react';
import SeoHead from '../components/SeoHead';
import Login from '../components/Login';

export default function Auth() {
  return (
    <>
      <SeoHead
        title="Sign In / Register"
        description="MshindiRoom Authentication: Sign up or log in securely to access jackpot consensus, free matches, and punter leaderboards."
        noIndex={true}
      />
      <div id="recaptcha-container"></div>
      <Login />
    </>
  );
}
