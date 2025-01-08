'use client';
import Image from "next/image";



export default function Home() {

  const handleInstall = () => {
    // Add installation logic here
  };

  const handleHowItWorks = () => {
    // Add how it works logic here
  };

  return (
    <div className="min-h-screen relative bg-black">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('/hero.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      {/* Content Overlay */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-6">
            {/* <Shield className="w-8 h-8" /> */}
            <span className="font-bold text-xl text-white">Leaderboard</span>
            <span className="text-white">How it works</span>
          </div>
          <button className="bg-white text-black px-4 py-2 rounded-lg">
            Install extension
          </button>
        </nav>

        {/* Main Content */}
        <main className="flex items-center justify-center px-4 h-[calc(100vh-5rem)]">
          <div className="max-w-xl w-full bg-black/30 backdrop-blur-sm rounded-xl p-8 space-y-6">
            <h1 className="text-4xl font-bold text-center text-white">#TEECEPTION</h1>
            
            <div className="space-y-4">
              <p className="text-center text-gray-200">
                Compete for real ETH rewards by challenging agents or creating your own
              </p>
              <p className="text-center text-gray-200">
                Powered by Thrill Network and hardware-backed TEE
              </p>
              <p className="text-center text-gray-200">
                Engage with the Agents directly on X (formerly Twitter)
              </p>
              <p className="text-center text-gray-200">
                On-chain verifications ensure fair play
              </p>
            </div>

            <div className="flex justify-center space-x-4">
              <button
                onClick={handleInstall}
                className="bg-white hover:bg-gray-100 text-black px-8 py-3 rounded-lg transition-colors w-48"
              >
                Install extension
              </button>
              <button
                onClick={handleHowItWorks}
                className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-lg transition-colors w-48"
              >
                How it works
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

