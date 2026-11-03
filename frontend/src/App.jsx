
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";

import "./App.css";

import GetCurrentUser from "./hooks/GetCurrentUser";
import GetSuggestedUsers from "./hooks/Getsugesteduser";

// Development and production API URL
export const ServerUrl = import.meta.env.DEV
  ? "http://localhost:5000"
  : window.location.origin;

// Lazy loaded components
const Signup = lazy(() => import("./components/Signup"));
const Signin = lazy(() => import("./components/Signin"));
const Home = lazy(() => import("./components/Home"));
const Forgotpassword = lazy(() => import("./components/Forgotpassword"));

const Aiimg = lazy(() => import("./components/Aiimg"));
const Profile = lazy(() => import("./components/Profile"));
const Editprofile = lazy(() => import("./components/Editprofile"));
const Upload = lazy(() => import("./components/Upload"));

const Reels = lazy(() => import("./components/Reels"));
const CreateStory = lazy(() => import("./components/CreateStory"));
const Stories = lazy(() => import("./components/Stories"));

const Message = lazy(() => import("./components/Message"));
const Saved = lazy(() => import("./components/Saved"));

const Post = lazy(() => import("./components/Post"));
const Reel = lazy(() => import("./components/Reel"));
const Search = lazy(() => import("./components/Search"));

// Loading component
const PageLoader = () => {
  return (
    <div className="w-full h-screen flex justify-center items-center">
      <div className="loader"></div>
    </div>
  );
};

function App() {
  // Fetch current logged-in user
  GetCurrentUser();

  const { userdata, loading, authChecked } = useSelector(
    (state) => state.user
  );

  // Authentication loading
  if (loading && !authChecked) {
    return <PageLoader />;
  }

  return (
    <>
      {/* Fetch suggested users only when logged in */}
      {userdata && <GetSuggestedUsers />}

      {/* Lazy loading fallback */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Home */}
          <Route
            path="/"
            element={
              userdata ? <Home /> : <Navigate to="/signin" replace />
            }
          />

          {/* Authentication */}
          <Route
            path="/signup"
            element={
              !userdata ? <Signup /> : <Navigate to="/" replace />
            }
          />

          <Route
            path="/signin"
            element={
              !userdata ? <Signin /> : <Navigate to="/" replace />
            }
          />

          <Route
            path="/forgotpassword"
            element={
              !userdata ? (
                <Forgotpassword />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* AI */}
          <Route path="/ai" element={<Aiimg />} />

          {/* Posts and uploads */}
          <Route path="/upload" element={<Upload />} />
          <Route path="/post/:id" element={<Post />} />

          {/* Profile */}
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/editprofile" element={<Editprofile />} />

          {/* Reels */}
          <Route path="/reels" element={<Reels />} />
          <Route path="/reel/:id" element={<Reel />} />

          {/* Stories */}
          <Route path="/create-story" element={<CreateStory />} />
          <Route path="/stories" element={<Stories />} />

          {/* Messages */}
          <Route path="/messages" element={<Message />} />

          {/* Saved posts */}
          <Route path="/saved" element={<Saved />} />

          {/* Search */}
          <Route path="/search" element={<Search />} />

          {/* Unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
